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
  ) {
    super(authTokenService, 'realtime');
  }

  afterInit(server: Server) {
    this.realtimeEvents.bindServer(server);
  }

  async handleConnection(client: AuthenticatedSocket) {
    await super.handleConnection(client);

    if (client.user?.id) {
      this.realtimeEvents.addUserSocket(client.user.id, client.id);
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    super.handleDisconnect(client);

    if (client.user?.id) {
      this.realtimeEvents.removeUserSocket(client.user.id, client.id);
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
}
