import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { paginate } from '@common/lib/paginate/paginate';
import { PaginationDto } from '@common/lib/paginate/paginate.dto';
import { User } from '@modules/user/user.entity';
import { CreateChatRoomDto, CreateGroupChatRoomDto, CreateMessageDto } from './chat.dto';
import { ChatGateway } from './chat.gateway';
import { ChatRoom, ChatRoomType } from './chat-room.entity';
import { ChatRoomRead } from './chat-room-read.entity';
import { Message } from './message.entity';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(ChatRoom)
    private readonly chatRoomRepository: Repository<ChatRoom>,
    @InjectRepository(ChatRoomRead)
    private readonly chatRoomReadRepository: Repository<ChatRoomRead>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  async createRoom(ownerId: ID, dto: CreateChatRoomDto) {
    if (ownerId === dto.to) {
      throw new BadRequestException('Cannot create a direct chat with yourself');
    }

    const participants = await this.findUsersByIdsOrFail([ownerId, dto.to]);
    const participant = participants.find((user) => user.id === dto.to);
    const directKey = this.createDirectKey(ownerId, dto.to);
    const room =
      (await this.findDirectRoomByKey(directKey)) ??
      (await this.findAndClaimLegacyDirectRoom(ownerId, dto.to, directKey)) ??
      (await this.createDirectRoom(directKey, participant?.name, participants));
    await this.ensureDirectRoomType(room);

    const firstMessage = await this.createMessageInRoom(ownerId, room, dto.firstMessage);

    return { ...this.withoutDirectKey(room), firstMessage };
  }

  async createGroupRoom(ownerId: ID, dto: CreateGroupChatRoomDto) {
    const participantIds = Array.from(new Set([ownerId, ...dto.participantIds]));

    if (participantIds.length < 2) {
      throw new BadRequestException('Chat room must have at least two participants');
    }

    const participants = await this.findUsersByIdsOrFail(participantIds);

    const room = this.chatRoomRepository.create({
      name: dto.name?.trim() || undefined,
      type: ChatRoomType.GROUP,
      participants,
    });

    const savedRoom = await this.chatRoomRepository.save(room);
    const firstMessage = await this.createMessageInRoom(ownerId, savedRoom, dto.firstMessage);

    return { ...this.withResolvedType(savedRoom), firstMessage };
  }

  getMyRooms(userId: ID, paginationDto: PaginationDto) {
    const qb = this.chatRoomRepository
      .createQueryBuilder('room')
      .addSelect('room.directKey')
      .innerJoin('room.participants', 'currentUser', 'currentUser.id = :userId', { userId })
      .leftJoinAndSelect('room.participants', 'participants')
      .leftJoinAndSelect('room.readStates', 'readStates', 'readStates.userId = :userId', {
        userId,
      })
      .orderBy('room.updatedAt', 'DESC');

    return paginate(qb, paginationDto).then((result) => ({
      ...result,
      data: result.data.map((room) => this.withoutDirectKey(room)),
    }));
  }

  async sendMessage(senderId: ID, chatRoomId: ID, dto: CreateMessageDto) {
    const room = await this.findRoomForUser(chatRoomId, senderId);
    return this.createMessageInRoom(senderId, room, dto.content);
  }

  async getRoomMessages(userId: ID, roomId: ID, paginationDto: PaginationDto) {
    await this.findRoomForUser(roomId, userId);

    const qb = this.createMessageQuery()
      .where('message.chatRoomId = :roomId', { roomId })
      .orderBy('message.createdAt', 'DESC');

    return paginate(qb, paginationDto);
  }

  async getUnreadMessages(userId: ID) {
    const count = await this.getUnreadMessagesCount(userId);

    return { unreadMessages: count };
  }

  async markAsRead(userId: ID, messageId: ID) {
    const message = await this.findOneForUser(messageId, userId);

    return this.upsertRoomReadState(userId, message.chatRoomId, message);
  }

  async markRoomAsRead(userId: ID, roomId: ID) {
    await this.findRoomForUser(roomId, userId);

    const latestMessage = await this.messageRepository.findOne({
      where: { chatRoomId: roomId },
      order: { createdAt: 'DESC', id: 'DESC' },
    });

    return this.upsertRoomReadState(userId, roomId, latestMessage ?? undefined);
  }

  async markRoomReadState(userId: ID, roomId: ID, lastReadMessageId?: ID) {
    if (!lastReadMessageId) {
      return this.markRoomAsRead(userId, roomId);
    }

    const message = await this.findOneForUser(lastReadMessageId, userId);

    if (message.chatRoomId !== roomId) {
      throw new BadRequestException('Message does not belong to this chat room');
    }

    return this.upsertRoomReadState(userId, roomId, message);
  }

  async getRoomParticipantIds(roomId: ID) {
    const room = await this.chatRoomRepository.findOne({
      where: { id: roomId },
      relations: ['participants'],
    });

    if (!room) {
      throw new NotFoundException('Chat room not found');
    }

    return room.participants.map((participant) => participant.id);
  }

  async remove(userId: ID, messageId: ID) {
    const message = await this.findOneForUser(messageId, userId);

    return this.messageRepository.remove(message);
  }

  private async createMessageInRoom(senderId: ID, room: ChatRoom, content: string) {
    const message = this.messageRepository.create({
      content,
      chatRoomId: room.id,
      senderId,
    });
    const savedMessage = await this.messageRepository.save(message);
    await this.chatRoomRepository.update(room.id, { updatedAt: savedMessage.createdAt });
    room.updatedAt = savedMessage.createdAt;

    const fullMessage = await this.findOneForUser(savedMessage.id, senderId);
    const receiverIds = this.getMessageReceiverIds(room, senderId);

    await Promise.all(
      receiverIds.map((receiverId) => this.emitNewMessage(receiverId, fullMessage)),
    );

    return fullMessage;
  }

  private async emitNewMessage(receiverId: ID, message: Message) {
    const unreadMessages = await this.getUnreadMessagesCount(receiverId);

    this.chatGateway.emitNewMessageToUser(receiverId, {
      data: message,
      unreadMessages,
    });
  }

  private async getUnreadMessagesCount(userId: ID) {
    const count = await this.messageRepository
      .createQueryBuilder('message')
      .innerJoin('message.chatRoom', 'room')
      .innerJoin('room.participants', 'participant', 'participant.id = :userId', { userId })
      .leftJoin(
        ChatRoomRead,
        'readState',
        'readState.chatRoomId = room.id AND readState.userId = :userId',
        { userId },
      )
      .where('message.senderId != :userId', { userId })
      .andWhere('(readState.lastReadAt IS NULL OR message.createdAt > readState.lastReadAt)')
      .getCount();

    return count;
  }

  private async upsertRoomReadState(userId: ID, roomId: ID, message?: Message) {
    const existingReadState = await this.chatRoomReadRepository.findOneBy({
      chatRoomId: roomId,
      userId,
    });
    const nextLastReadAt = message?.createdAt ?? new Date();

    if (existingReadState?.lastReadAt && existingReadState.lastReadAt >= nextLastReadAt) {
      return existingReadState;
    }

    await this.chatRoomReadRepository.upsert(
      {
        chatRoomId: roomId,
        userId,
        lastReadMessageId: message?.id,
        lastReadAt: nextLastReadAt,
      },
      ['chatRoomId', 'userId'],
    );

    const readState = await this.chatRoomReadRepository.findOneBy({ chatRoomId: roomId, userId });
    if (!readState) {
      throw new NotFoundException('Read state not found');
    }

    return readState;
  }

  private createMessageQuery() {
    return this.messageRepository
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.sender', 'sender')
      .leftJoinAndSelect('message.chatRoom', 'chatRoom');
  }

  private assertCanAccessMessage(message: Message, userId: ID) {
    const isRoomParticipant = message.chatRoom?.participants?.some(
      (participant) => participant.id === userId,
    );

    if (!isRoomParticipant) {
      throw new ForbiddenException();
    }
  }

  private async findOneForUser(messageId: ID, userId: ID) {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
      relations: ['sender', 'chatRoom', 'chatRoom.participants'],
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    this.assertCanAccessMessage(message, userId);

    return message;
  }

  private async findRoomForUser(roomId: ID, userId: ID) {
    const room = await this.chatRoomRepository.findOne({
      where: { id: roomId },
      relations: ['participants'],
    });

    if (!room) {
      throw new NotFoundException('Chat room not found');
    }

    const hasAccess = room.participants.some((participant) => participant.id === userId);
    if (!hasAccess) {
      throw new ForbiddenException();
    }

    return room;
  }

  private findDirectRoomByKey(directKey: string) {
    return this.chatRoomRepository
      .createQueryBuilder('room')
      .addSelect('room.directKey')
      .leftJoinAndSelect('room.participants', 'participants')
      .where('room.directKey = :directKey', { directKey })
      .getOne();
  }

  private async findAndClaimLegacyDirectRoom(userId: ID, participantId: ID, directKey: string) {
    const room = await this.findLegacyDirectRoomForUsers(userId, participantId);
    if (!room) {
      return null;
    }

    try {
      await this.chatRoomRepository.update(room.id, {
        directKey,
        type: ChatRoomType.DIRECT,
      });
      room.directKey = directKey;
      room.type = ChatRoomType.DIRECT;
      return room;
    } catch (error) {
      const existingRoom = await this.findDirectRoomByKey(directKey);
      if (existingRoom) {
        return existingRoom;
      }

      throw error;
    }
  }

  private findLegacyDirectRoomForUsers(userId: ID, participantId: ID) {
    return this.chatRoomRepository
      .createQueryBuilder('room')
      .innerJoinAndSelect('room.participants', 'participants')
      .where((qb) => {
        const subQuery = qb
          .subQuery()
          .select('candidateRoom.id')
          .from(ChatRoom, 'candidateRoom')
          .innerJoin('candidateRoom.participants', 'participant')
          .groupBy('candidateRoom.id')
          .having('COUNT(participant.id) = 2')
          .andHaving('COUNT(CASE WHEN participant.id IN (:...participantIds) THEN 1 END) = 2')
          .getQuery();

        return `room.id IN ${subQuery}`;
      })
      .andWhere('room.directKey IS NULL')
      .andWhere('(room.type IS NULL OR room.type = :directType)', {
        directType: ChatRoomType.DIRECT,
      })
      .setParameter('participantIds', [userId, participantId])
      .orderBy('room.updatedAt', 'DESC')
      .getOne();
  }

  private async createDirectRoom(
    directKey: string,
    name: string | undefined,
    participants: User[],
  ) {
    try {
      return await this.chatRoomRepository.save(
        this.chatRoomRepository.create({
          name,
          type: ChatRoomType.DIRECT,
          directKey,
          participants,
        }),
      );
    } catch (error) {
      const existingRoom = await this.findDirectRoomByKey(directKey);
      if (existingRoom) {
        return existingRoom;
      }

      throw error;
    }
  }

  private async ensureDirectRoomType(room: ChatRoom) {
    if (room.type === ChatRoomType.DIRECT) {
      return;
    }

    await this.chatRoomRepository.update(room.id, { type: ChatRoomType.DIRECT });
    room.type = ChatRoomType.DIRECT;
  }

  private getMessageReceiverIds(room: ChatRoom, senderId: ID) {
    return room.participants
      .map((participant) => participant.id)
      .filter((participantId) => participantId !== senderId);
  }

  private createDirectKey(firstUserId: ID, secondUserId: ID) {
    return [firstUserId, secondUserId].sort().join(':');
  }

  private withoutDirectKey(room: ChatRoom) {
    const { directKey, ...publicRoom } = this.withResolvedType(room);
    void directKey;
    return publicRoom;
  }

  private withResolvedType(room: ChatRoom) {
    if (room.type) {
      return room;
    }

    return {
      ...room,
      type: room.directKey ? ChatRoomType.DIRECT : ChatRoomType.GROUP,
    };
  }

  private async findUsersByIdsOrFail(userIds: ID[]) {
    const uniqueIds = Array.from(new Set(userIds));
    const users = await this.userRepository.find({ where: { id: In(uniqueIds) } });

    if (users.length !== uniqueIds.length) {
      const foundIds = new Set(users.map((user) => user.id));
      const missingIds = uniqueIds.filter((userId) => !foundIds.has(userId));
      throw new BadRequestException(`User not found: ${missingIds.join(', ')}`);
    }

    return users;
  }
}
