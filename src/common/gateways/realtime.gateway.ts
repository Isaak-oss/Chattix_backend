import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { AuthTokenService } from '@modules/auth/auth-token.service';
import { AuthenticatedGateway } from './authenticated.gateway';
import type { AuthenticatedSocket } from './authenticated.gateway';
import { RealtimeEventsService } from './realtime-events.service';
import { PresenceService } from './presence.service';

type UserOnlinePayload = {
  isOnline?: boolean;
};

@WebSocketGateway({
  namespace: 'realtime',
  cors: {
    origin: process.env.GATEWAY_ORIGIN?.split(','),
    credentials: true,
  },
})
export class RealtimeGateway extends AuthenticatedGateway {
  constructor(
    authTokenService: AuthTokenService,
    private readonly realtimeEvents: RealtimeEventsService,
    private readonly presenceService: PresenceService,
  ) {
    super(authTokenService, 'realtime');
  }

  afterInit(server: Server) {
    this.realtimeEvents.bindServer(server);
  }

  async handleConnection(client: AuthenticatedSocket) {
    await super.handleConnection(client);

    if (client.user?.id) {
      const wasOffline = this.realtimeEvents.addUserSocket(client.user.id, client.id);
      if (wasOffline) {
        await this.presenceService.handleUserConnected(client.user.id);
      }
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    super.handleDisconnect(client);

    if (client.user?.id) {
      const isOffline = this.realtimeEvents.removeUserSocket(client.user.id, client.id);
      if (isOffline) {
        await this.presenceService.handleUserDisconnected(client.user.id);
      }
    }
  }

  @SubscribeMessage('notifications:ping')
  handleNotificationsPing(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: unknown,
  ) {
    return this.realtimeEvents.handle('notifications:ping', client, body);
  }

  @SubscribeMessage('chats:read')
  handleChatsRead(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() body: unknown) {
    return this.realtimeEvents.handle('chats:read', client, body);
  }

  @SubscribeMessage('friends:onlineStatus')
  async handleFriendsOnlineStatus(@ConnectedSocket() client: AuthenticatedSocket) {
    const userId = client.user?.id;
    if (!userId) {
      const payload = { message: 'Unauthorized' };
      client.emit('realtime:error', payload);
      return { error: payload };
    }

    const statuses = await this.presenceService.getFriendsOnlineStatus(userId);

    return { data: statuses };
  }

  @SubscribeMessage('user:online')
  async handleUserOnline(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: UserOnlinePayload,
  ) {
    const userId = client.user?.id;
    if (!userId) {
      const payload = { message: 'Unauthorized' };
      client.emit('realtime:error', payload);
      return { error: payload };
    }

    if (typeof body?.isOnline !== 'boolean') {
      const payload = { message: 'isOnline must be a boolean' };
      client.emit('realtime:error', payload);
      return { error: payload };
    }

    return this.presenceService.handleUserOnlineStatusChanged(userId, body.isOnline);
  }
}
