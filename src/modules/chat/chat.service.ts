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
import {
  CreateChatRoomDto,
  CreateGroupChatRoomDto,
  CreateMessageDto,
  RoomMessagesQueryDto,
} from './chat.dto';
import { ChatGateway } from './chat.gateway';
import { ChatRoom, ChatRoomType } from './chat-room.entity';
import { ChatRoomRead } from './chat-room-read.entity';
import { Message } from './message.entity';
import { RealtimeEventsService } from '@common/gateways/realtime-events.service';

type MessageAnchor = Pick<Message, 'id' | 'createdAt'>;
type ReadAnchorSource = 'lastReadMessageId' | 'lastReadAt' | 'lastReadAtAfter';

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
    private readonly realtimeEvents: RealtimeEventsService,
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
    const publicRoom = await this.findRoomResponseForUser(ownerId, room.id);

    return { ...publicRoom, firstMessage };
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
    const publicRoom = await this.findRoomResponseForUser(ownerId, savedRoom.id);

    return { ...publicRoom, firstMessage };
  }

  async getMyRooms(userId: ID, paginationDto: PaginationDto) {
    const qb = this.createRoomResponseQuery(userId).innerJoin(
      'room.participants',
      'currentUser',
      'currentUser.id = :userId',
      { userId },
    );

    const result = await paginate(qb, paginationDto, { alias: 'room', cursorColumn: 'updatedAt' });
    await this.attachUnreadMessagesCounts(userId, result.data);

    return {
      ...result,
      data: result.data.map((room) => this.withoutDirectKey(room)),
    };
  }

  async getRoom(userId: ID, roomId: ID) {
    return this.findRoomResponseForUser(userId, roomId);
  }

  private async findRoomResponseForUser(userId: ID, roomId: ID) {
    const room = await this.createRoomResponseQuery(userId)
      .where('room.id = :roomId', { roomId })
      .getOne();

    if (!room) {
      throw new NotFoundException('Chat room not found');
    }

    const hasAccess = room.participants.some((participant) => participant.id === userId);
    if (!hasAccess) {
      throw new ForbiddenException();
    }

    await this.attachUnreadMessagesCount(userId, room);

    return this.withoutDirectKey(room);
  }

  async sendMessage(senderId: ID, chatRoomId: ID, dto: CreateMessageDto) {
    const room = await this.findRoomForUser(chatRoomId, senderId);
    return this.createMessageInRoom(senderId, room, dto.content);
  }

  async getRoomMessages(userId: ID, roomId: ID, paginationDto: RoomMessagesQueryDto) {
    await this.findRoomForUser(roomId, userId);

    if (this.usesMessageIdPagination(paginationDto)) {
      return this.getRoomMessagesByMessageId(userId, roomId, paginationDto);
    }

    const qb = this.createMessageQuery().where('message.chatRoomId = :roomId', { roomId });

    return paginate(qb, paginationDto, { alias: 'message', cursorColumn: 'createdAt' });
  }

  private async getRoomMessagesByMessageId(
    userId: ID,
    roomId: ID,
    paginationDto: RoomMessagesQueryDto,
  ) {
    this.assertSingleMessagePaginationMode(paginationDto);

    const limit = this.getMessagePageLimit(paginationDto.limit);

    if (paginationDto.aroundLastRead) {
      return this.getRoomMessagesAroundLastRead(userId, roomId, limit);
    }

    if (paginationDto.before) {
      const anchor = await this.findMessageAnchor(roomId, paginationDto.before);
      const { data, hasMore } = await this.getMessagesBeforeAnchor(roomId, anchor, limit);

      return {
        data,
        meta: {
          limit,
          before: paginationDto.before,
          nextBefore: hasMore ? data[data.length - 1]?.id : undefined,
          hasMoreBefore: hasMore,
          hasMoreAfter: false,
          order: 'DESC',
        },
      };
    }

    if (paginationDto.after) {
      const anchor = await this.findMessageAnchor(roomId, paginationDto.after);
      const { data, hasMore } = await this.getMessagesAfterAnchor(roomId, anchor, limit);

      return {
        data,
        meta: {
          limit,
          after: paginationDto.after,
          nextAfter: hasMore ? data[data.length - 1]?.id : undefined,
          hasMoreBefore: false,
          hasMoreAfter: hasMore,
          order: 'ASC',
        },
      };
    }

    throw new BadRequestException('Message pagination mode is required');
  }

  private async getRoomMessagesAroundLastRead(userId: ID, roomId: ID, limit: number) {
    const readAnchor = await this.findLastReadAnchor(userId, roomId);

    if (!readAnchor) {
      const { data, hasMore } = await this.getLatestMessages(roomId, limit);

      return {
        data,
        meta: {
          limit,
          aroundLastRead: true,
          anchorMessageId: undefined,
          anchorSource: 'none',
          nextBefore: hasMore ? data[data.length - 1]?.id : undefined,
          hasMoreBefore: hasMore,
          hasMoreAfter: false,
          order: 'DESC',
        },
      };
    }

    const beforeLimit = Math.floor((limit - 1) / 2);
    const afterLimit = limit - 1 - beforeLimit;
    const [before, anchorMessage, after] = await Promise.all([
      this.getMessagesBeforeAnchor(roomId, readAnchor.message, beforeLimit),
      this.getMessageById(roomId, readAnchor.message.id),
      this.getMessagesAfterAnchor(roomId, readAnchor.message, afterLimit),
    ]);

    const olderMessages = [...before.data].reverse();
    const data = [...olderMessages, anchorMessage, ...after.data];

    return {
      data,
      meta: {
        limit,
        aroundLastRead: true,
        anchorMessageId: readAnchor.message.id,
        anchorSource: readAnchor.source,
        nextBefore: before.hasMore ? olderMessages[0]?.id : undefined,
        nextAfter: after.hasMore ? after.data[after.data.length - 1]?.id : undefined,
        hasMoreBefore: before.hasMore,
        hasMoreAfter: after.hasMore,
        order: 'ASC',
      },
    };
  }

  private usesMessageIdPagination(paginationDto: RoomMessagesQueryDto) {
    return Boolean(paginationDto.before || paginationDto.after || paginationDto.aroundLastRead);
  }

  private assertSingleMessagePaginationMode(paginationDto: RoomMessagesQueryDto) {
    const modes = [
      paginationDto.cursor,
      paginationDto.before,
      paginationDto.after,
      paginationDto.aroundLastRead,
    ].filter(Boolean);

    if (modes.length > 1) {
      throw new BadRequestException('Use only one of cursor, before, after, or aroundLastRead');
    }
  }

  private getMessagePageLimit(limit?: number) {
    return Math.min(limit || 20, 50);
  }

  private async getLatestMessages(roomId: ID, limit: number) {
    return this.getMessagePage(
      this.createMessageQuery()
        .where('message.chatRoomId = :roomId', { roomId })
        .orderBy('message.createdAt', 'DESC')
        .addOrderBy('message.id', 'DESC'),
      limit,
    );
  }

  private async findMessageAnchor(roomId: ID, messageId: ID): Promise<MessageAnchor> {
    const message = await this.messageRepository.findOne({
      where: { id: messageId, chatRoomId: roomId },
      select: { id: true, createdAt: true },
    });

    if (!message) {
      throw new NotFoundException('Message anchor not found');
    }

    return message;
  }

  private async getMessageById(roomId: ID, messageId: ID) {
    const message = await this.createMessageQuery()
      .where('message.id = :messageId', { messageId })
      .andWhere('message.chatRoomId = :roomId', { roomId })
      .getOne();

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    return message;
  }

  private async getMessagesBeforeAnchor(roomId: ID, anchor: MessageAnchor, limit: number) {
    return this.getMessagePage(
      this.createMessageQuery()
        .where('message.chatRoomId = :roomId', { roomId })
        .andWhere(
          '(message.createdAt < :anchorCreatedAt OR (message.createdAt = :anchorCreatedAt AND message.id < :anchorId))',
          { anchorCreatedAt: anchor.createdAt, anchorId: anchor.id },
        )
        .orderBy('message.createdAt', 'DESC')
        .addOrderBy('message.id', 'DESC'),
      limit,
    );
  }

  private async getMessagesAfterAnchor(roomId: ID, anchor: MessageAnchor, limit: number) {
    return this.getMessagePage(
      this.createMessageQuery()
        .where('message.chatRoomId = :roomId', { roomId })
        .andWhere(
          '(message.createdAt > :anchorCreatedAt OR (message.createdAt = :anchorCreatedAt AND message.id > :anchorId))',
          { anchorCreatedAt: anchor.createdAt, anchorId: anchor.id },
        )
        .orderBy('message.createdAt', 'ASC')
        .addOrderBy('message.id', 'ASC'),
      limit,
    );
  }

  private async getMessagePage(qb: ReturnType<ChatService['createMessageQuery']>, limit: number) {
    if (limit <= 0) {
      return { data: [], hasMore: false };
    }

    const messages = await qb.take(limit + 1).getMany();
    const hasMore = messages.length > limit;

    return {
      data: hasMore ? messages.slice(0, limit) : messages,
      hasMore,
    };
  }

  private async findLastReadAnchor(
    userId: ID,
    roomId: ID,
  ): Promise<{ message: MessageAnchor; source: ReadAnchorSource } | null> {
    const readState = await this.chatRoomReadRepository.findOne({
      where: { chatRoomId: roomId, userId },
      relations: ['lastReadMessage'],
    });

    if (!readState) {
      return null;
    }

    if (readState.lastReadMessage) {
      return {
        message: readState.lastReadMessage,
        source: 'lastReadMessageId',
      };
    }

    if (!readState.lastReadAt) {
      return null;
    }

    const messageBeforeOrAtLastRead = await this.messageRepository
      .createQueryBuilder('message')
      .select(['message.id', 'message.createdAt'])
      .where('message.chatRoomId = :roomId', { roomId })
      .andWhere(
        "message.createdAt < (CAST(:lastReadAt AS timestamptz) + INTERVAL '1 millisecond')",
        {
          lastReadAt: readState.lastReadAt,
        },
      )
      .orderBy('message.createdAt', 'DESC')
      .addOrderBy('message.id', 'DESC')
      .getOne();

    if (messageBeforeOrAtLastRead) {
      return {
        message: messageBeforeOrAtLastRead,
        source: 'lastReadAt',
      };
    }

    const messageAfterLastRead = await this.messageRepository
      .createQueryBuilder('message')
      .select(['message.id', 'message.createdAt'])
      .where('message.chatRoomId = :roomId', { roomId })
      .andWhere('message.createdAt > :lastReadAt', { lastReadAt: readState.lastReadAt })
      .orderBy('message.createdAt', 'ASC')
      .addOrderBy('message.id', 'ASC')
      .getOne();

    if (messageAfterLastRead) {
      return {
        message: messageAfterLastRead,
        source: 'lastReadAtAfter',
      };
    }

    return null;
  }

  async getUnreadMessages(userId: ID) {
    const count = await this.getUnreadMessagesCount(userId);

    return { unreadMessagesCount: count };
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

  async createRoomReadEventPayload(userId: ID, roomId: ID, readState: unknown) {
    const [lastMessage, counts] = await Promise.all([
      this.createMessageQuery()
        .where('message.chatRoomId = :roomId', { roomId })
        .orderBy('message.createdAt', 'DESC')
        .addOrderBy('message.id', 'DESC')
        .getOne(),
      this.getUnreadMessagesCounts(userId, roomId),
    ]);

    return {
      readState,
      lastMessage,
      unreadMessagesCount: counts.unreadMessagesCount,
      totalUnreadMessagesCount: counts.totalUnreadMessagesCount,
    };
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
    fullMessage.chatRoom = await this.findRoomResponseForUser(senderId, room.id);
    const receiverIds = this.getMessageReceiverIds(room, senderId);

    await Promise.all(
      receiverIds.map((receiverId) => this.emitNewMessage(receiverId, fullMessage)),
    );

    return fullMessage;
  }

  private async emitNewMessage(receiverId: ID, message: Message) {
    const chatRoom = await this.findRoomResponseForUser(receiverId, message.chatRoomId);
    const unreadMessagesCount = chatRoom.unreadMessagesCount ?? 0;

    this.chatGateway.emitNewMessageToUser(receiverId, {
      data: {
        ...message,
        chatRoom,
      },
      unreadMessagesCount,
    });
  }

  private createRoomResponseQuery(userId: ID) {
    const lastMessageSubQuery = this.messageRepository
      .createQueryBuilder('lastMessageSub')
      .select('lastMessageSub.id')
      .where('lastMessageSub.chatRoomId = room.id')
      .orderBy('lastMessageSub.createdAt', 'DESC')
      .addOrderBy('lastMessageSub.id', 'DESC')
      .limit(1)
      .getQuery();

    return this.chatRoomRepository
      .createQueryBuilder('room')
      .addSelect('room.directKey')
      .leftJoinAndSelect('room.participants', 'participants')
      .leftJoinAndMapOne(
        'room.lastMessage',
        'room.messages',
        'lastMessage',
        `lastMessage.id = (${lastMessageSubQuery})`,
      )
      .leftJoinAndSelect('lastMessage.sender', 'lastMessageSender')
      .leftJoinAndSelect('room.readStates', 'readStates', 'readStates.userId = :userId', {
        userId,
      });
  }

  private async attachUnreadMessagesCount(userId: ID, room: ChatRoom) {
    room.unreadMessagesCount = await this.getUnreadMessagesCount(userId, room.id);
  }

  private async attachUnreadMessagesCounts(userId: ID, rooms: ChatRoom[]) {
    if (rooms.length === 0) {
      return;
    }

    const roomIds = rooms.map((room) => room.id);
    const rows = await this.messageRepository
      .createQueryBuilder('message')
      .select('message.chatRoomId', 'roomId')
      .addSelect('COUNT(message.id)', 'count')
      .leftJoin(
        ChatRoomRead,
        'readState',
        'readState.chatRoomId = message.chatRoomId AND readState.userId = :userId',
        { userId },
      )
      .leftJoin(Message, 'lastReadMessage', 'lastReadMessage.id = readState.lastReadMessageId')
      .where('message.chatRoomId IN (:...roomIds)', { roomIds })
      .andWhere('message.senderId != :userId', { userId })
      .andWhere(this.getUnreadMessagesWhereClause())
      .groupBy('message.chatRoomId')
      .getRawMany<{ roomId: ID; count: string }>();

    const countsByRoomId = new Map(rows.map((row) => [row.roomId, Number(row.count)]));
    rooms.forEach((room) => {
      room.unreadMessagesCount = countsByRoomId.get(room.id) ?? 0;
    });
  }

  private async getUnreadMessagesCount(userId: ID, roomId?: ID) {
    const qb = this.messageRepository
      .createQueryBuilder('message')
      .innerJoin('message.chatRoom', 'room')
      .innerJoin('room.participants', 'participant', 'participant.id = :userId', { userId })
      .leftJoin(
        ChatRoomRead,
        'readState',
        'readState.chatRoomId = room.id AND readState.userId = :userId',
        { userId },
      )
      .leftJoin(Message, 'lastReadMessage', 'lastReadMessage.id = readState.lastReadMessageId')
      .where('message.senderId != :userId', { userId })
      .andWhere(this.getUnreadMessagesWhereClause());

    if (roomId) {
      qb.andWhere('message.chatRoomId = :roomId', { roomId });
    }

    const count = await qb.getCount();

    return count;
  }

  private async getUnreadMessagesCounts(userId: ID, roomId: ID) {
    const result = await this.messageRepository
      .createQueryBuilder('message')
      .select('COUNT(message.id)', 'totalUnreadMessagesCount')
      .addSelect('COUNT(CASE WHEN message.chatRoomId = :roomId THEN 1 END)', 'unreadMessagesCount')
      .innerJoin('message.chatRoom', 'room')
      .innerJoin('room.participants', 'participant', 'participant.id = :userId', { userId })
      .leftJoin(
        ChatRoomRead,
        'readState',
        'readState.chatRoomId = room.id AND readState.userId = :userId',
        { userId },
      )
      .leftJoin(Message, 'lastReadMessage', 'lastReadMessage.id = readState.lastReadMessageId')
      .where('message.senderId != :userId', { userId })
      .andWhere(this.getUnreadMessagesWhereClause())
      .setParameter('roomId', roomId)
      .getRawOne<{
        totalUnreadMessagesCount?: string;
        unreadMessagesCount?: string;
      }>();

    return {
      unreadMessagesCount: Number(result?.unreadMessagesCount ?? 0),
      totalUnreadMessagesCount: Number(result?.totalUnreadMessagesCount ?? 0),
    };
  }

  private getUnreadMessagesWhereClause() {
    return [
      '(',
      'readState.id IS NULL',
      'OR (readState.lastReadMessageId IS NULL AND readState.lastReadAt IS NULL)',
      'OR message.createdAt > COALESCE(lastReadMessage.createdAt, readState.lastReadAt)',
      ')',
    ].join(' ');
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
      .leftJoinAndSelect('message.sender', 'sender');
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
    const message = await this.messageRepository
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.sender', 'sender')
      .leftJoinAndSelect('message.chatRoom', 'chatRoom')
      .leftJoinAndSelect('chatRoom.participants', 'participants')
      .leftJoinAndSelect('chatRoom.readStates', 'readStates', 'readStates.userId = :userId', {
        userId,
      })
      .where('message.id = :messageId', { messageId })
      .getOne();

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
    return this.withParticipantsOnlineStatus(publicRoom);
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

  private withParticipantsOnlineStatus<T extends Omit<ChatRoom, 'directKey'>>(room: T) {
    return {
      ...room,
      participants: room.participants?.map((participant) => ({
        ...participant,
        isOnline: this.realtimeEvents.isOnline(participant.id),
      })),
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
