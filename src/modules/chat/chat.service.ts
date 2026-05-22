import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { paginate } from '@common/lib/paginate/paginate';
import { PaginationDto } from '@common/lib/paginate/paginate.dto';
import { NotificationService } from '@modules/notification/notification.service';
import { NotificationType } from '@modules/notification/notification.types';
import { User } from '@modules/user/user.entity';
import { UserService } from '@modules/user/user.service';
import { CreateChatRoomDto, CreateMessageDto } from './chat.dto';
import { ChatRoom } from './chat-room.entity';
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
    private readonly userService: UserService,
    private readonly notificationService: NotificationService,
  ) {}

  async createRoom(ownerId: ID, dto: CreateChatRoomDto) {
    const participantIds = Array.from(new Set([ownerId, ...dto.participantIds]));

    if (participantIds.length < 2) {
      throw new BadRequestException('Chat room must have at least two participants');
    }

    const participants = (await Promise.all(
      participantIds.map((participantId) => this.userService.findOneById(participantId)),
    )) as User[];

    const room = this.chatRoomRepository.create({
      name: dto.name,
      participants,
    });

    const savedRoom = await this.chatRoomRepository.save(room);
    const firstMessage = await this.createMessageInRoom(ownerId, savedRoom, dto.firstMessage);

    return { ...savedRoom, firstMessage };
  }

  getMyRooms(userId: ID, paginationDto: PaginationDto) {
    const qb = this.chatRoomRepository
      .createQueryBuilder('room')
      .innerJoin('room.participants', 'currentUser', 'currentUser.id = :userId', { userId })
      .leftJoinAndSelect('room.participants', 'participants')
      .leftJoinAndSelect('room.readStates', 'readStates', 'readStates.userId = :userId', {
        userId,
      })
      .orderBy('room.updatedAt', 'DESC');

    return paginate(qb, paginationDto);
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

  async markAsRead(userId: ID, messageId: ID) {
    const message = await this.findOneForUser(messageId, userId);

    return this.upsertRoomReadState(userId, message.chatRoomId, message);
  }

  async markRoomAsRead(userId: ID, roomId: ID) {
    await this.findRoomForUser(roomId, userId);

    const latestMessage = await this.messageRepository.findOne({
      where: { chatRoomId: roomId },
      order: { createdAt: 'DESC' },
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
    const fullMessage = await this.findOneForUser(savedMessage.id, senderId);
    const receiverIds = this.getMessageReceiverIds(room, senderId);

    this.notificationService.notifyUsers(receiverIds, {
      type: NotificationType.MESSAGE,
      title: 'New message',
      message: content.slice(0, 120) || 'You have a new message',
      data: { senderId, messageId: savedMessage.id, chatRoomId: room.id },
    });

    return fullMessage;
  }

  private async upsertRoomReadState(userId: ID, roomId: ID, message?: Message) {
    const existingReadState = await this.chatRoomReadRepository.findOne({
      where: { chatRoomId: roomId, userId },
      relations: ['lastReadMessage'],
    });

    if (
      existingReadState?.lastReadMessage &&
      message &&
      existingReadState.lastReadMessage.createdAt > message.createdAt
    ) {
      return existingReadState;
    }

    const readState =
      existingReadState ?? this.chatRoomReadRepository.create({ chatRoomId: roomId, userId });

    if (message) {
      readState.lastReadMessageId = message.id;
    }

    readState.lastReadAt = new Date();

    return this.chatRoomReadRepository.save(readState);
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

  private async findDirectRoomForUsers(userId: ID, participantId: ID) {
    const directRoom = await this.chatRoomRepository
      .createQueryBuilder('room')
      .innerJoin('room.participants', 'requestedParticipant')
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
      .andWhere('requestedParticipant.id = :userId', { userId })
      .setParameter('participantIds', [userId, participantId])
      .getOne();

    if (!directRoom) {
      throw new NotFoundException('Conversation not found');
    }

    return directRoom;
  }

  private getMessageReceiverIds(room: ChatRoom, senderId: ID) {
    return room.participants
      .map((participant) => participant.id)
      .filter((participantId) => participantId !== senderId);
  }
}
