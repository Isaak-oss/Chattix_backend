import { forwardRef, Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { AuthenticatedSocket, GatewayUser } from '@common/gateways/authenticated.gateway';
import { RealtimeEventsService } from '@common/gateways/realtime-events.service';
import { ChatService } from './chat.service';

interface MarkRoomReadPayload {
  roomId?: ID;
  chatRoomId?: ID;
  lastReadMessageId?: ID;
  messageId?: ID;
}

type ChatSocket = AuthenticatedSocket<GatewayUser>;

interface NewMessagePayload {
  data: unknown;
  unreadMessagesCount: number;
}

@Injectable()
export class ChatGateway implements OnModuleInit {
  constructor(
    @Inject(forwardRef(() => ChatService))
    private readonly chatService: ChatService,
    private readonly realtimeEvents: RealtimeEventsService,
  ) {}

  onModuleInit() {
    this.realtimeEvents.registerHandler('chats:read', (client, body) =>
      this.handleRoomRead(client, body as MarkRoomReadPayload),
    );
  }

  async handleRoomRead(client: ChatSocket, body: MarkRoomReadPayload) {
    try {
      const userId = client.user?.id;
      if (!userId) {
        throw new Error('Unauthorized');
      }

      const roomId = body?.roomId ?? body?.chatRoomId;
      if (!roomId) {
        throw new Error('roomId is required');
      }

      const readState = await this.chatService.markRoomReadState(
        userId,
        roomId,
        body.lastReadMessageId ?? body.messageId,
      );
      const participantIds = await this.chatService.getRoomParticipantIds(roomId);
      const payload = await this.createRoomReadPayload(userId, roomId, readState);

      await Promise.all(
        participantIds.map(async (participantId) => {
          const participantPayload =
            participantId === userId
              ? payload
              : await this.createRoomReadPayload(participantId, roomId, readState);

          this.realtimeEvents.emitToUser(participantId, 'chats:read', participantPayload);
        }),
      );

      return payload;
    } catch (error) {
      const payload = {
        message: error instanceof Error ? error.message : 'Failed to mark chat as read',
      };
      client.emit('chats:error', payload);
      return { error: payload };
    }
  }

  emitNewMessageToUser(userId: ID, payload: NewMessagePayload) {
    this.realtimeEvents.emitToUser(userId, 'message:new', payload);
  }

  private createRoomReadPayload(userId: ID, roomId: ID, readState: unknown) {
    return this.chatService.createRoomReadEventPayload(userId, roomId, readState);
  }
}
