import { forwardRef, Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { AuthenticatedSocket, GatewayUser } from '@common/gateways/authenticated.gateway';
import { RealtimeEventsService } from '@common/gateways/realtime-events.service';
import { ChatService } from './chat.service';

interface MarkRoomReadPayload {
  roomId?: ID;
  lastReadMessageId?: ID;
}

type ChatSocket = AuthenticatedSocket<GatewayUser>;

interface NewMessagePayload {
  data: unknown;
  unreadMessages: number;
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

      const roomId = body?.roomId;
      if (!roomId) {
        throw new Error('roomId is required');
      }

      const readState = await this.chatService.markRoomReadState(
        userId,
        roomId,
        body.lastReadMessageId,
      );
      const participantIds = await this.chatService.getRoomParticipantIds(roomId);
      const payload = {
        chatRoomId: roomId,
        userId,
        lastReadMessageId: readState.lastReadMessageId,
        lastReadAt: readState.lastReadAt,
      };

      this.realtimeEvents.emitToUsers(participantIds, 'chats:read', payload);

      return { data: payload };
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
}
