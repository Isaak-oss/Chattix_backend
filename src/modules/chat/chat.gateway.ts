import { forwardRef, Inject } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { AuthTokenService } from '@modules/auth/auth-token.service';
import {
  AuthenticatedGateway,
  AuthenticatedSocket,
  GatewayUser,
} from '@common/gateways/authenticated.gateway';
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

@WebSocketGateway({
  namespace: 'chats',
  cors: {
    origin: process.env.GATEWAY_ORIGIN?.split(','),
    credentials: true,
  },
})
export class ChatGateway extends AuthenticatedGateway {
  constructor(
    authTokenService: AuthTokenService,
    @Inject(forwardRef(() => ChatService))
    private readonly chatService: ChatService,
  ) {
    super(authTokenService, 'chats');
  }

  @SubscribeMessage('chats:read')
  async handleRoomRead(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() body: MarkRoomReadPayload,
  ) {
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

      this.emitGatewayEventToUsers(participantIds, 'chats:read', payload);

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
    this.emitGatewayEventToUser(userId, 'message:new', payload);
  }
}
