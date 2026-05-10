import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthTokenService } from '@modules/auth/auth-token.service';
import { NotificationPayload, NotificationUser } from './notification.types';

type NotificationSocket = Socket & { user?: NotificationUser };

@WebSocketGateway({
  namespace: 'notifications',
  cors: {
    origin: process.env.GATEWAY_ORIGIN?.split(','),
    credentials: true,
  },
})
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private server: Server;

  private readonly socketsByUser = new Map<ID, Set<string>>();

  constructor(private readonly authTokenService: AuthTokenService) {}

  async handleConnection(client: NotificationSocket) {
    try {
      const user = await this.authenticate(client);
      client.user = user;
      await client.join(this.getUserRoom(user.id));

      const userSockets = this.socketsByUser.get(user.id) ?? new Set<string>();
      userSockets.add(client.id);
      this.socketsByUser.set(user.id, userSockets);

      client.emit('notifications:connected', { userId: user.id });
    } catch (error) {
      client.emit('notifications:error', {
        message: error instanceof Error ? error.message : 'Unauthorized',
      });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: NotificationSocket) {
    const userId = client.user?.id;
    if (!userId) return;

    const userSockets = this.socketsByUser.get(userId);
    if (!userSockets) return;

    userSockets.delete(client.id);
    if (userSockets.size === 0) {
      this.socketsByUser.delete(userId);
    }
  }

  @SubscribeMessage('notifications:ping')
  handlePing(@ConnectedSocket() client: NotificationSocket, @MessageBody() body: unknown) {
    client.emit('notifications:pong', {
      userId: client.user?.id,
      data: body ?? null,
      createdAt: new Date().toISOString(),
    });
  }

  emitToUser(userId: ID, notification: NotificationPayload<unknown>) {
    this.server.to(this.getUserRoom(userId)).emit('notifications:new', notification);
  }

  emitToUsers(userIds: ID[], notification: NotificationPayload<unknown>) {
    userIds.forEach((userId) => this.emitToUser(userId, notification));
  }

  emitSystem(notification: NotificationPayload<unknown>) {
    this.server.emit('notifications:new', notification);
  }

  isOnline(userId: ID) {
    return this.socketsByUser.has(userId);
  }

  private async authenticate(client: Socket): Promise<NotificationUser> {
    const token = this.authTokenService.extractSocketToken({
      authToken: client.handshake.auth?.token,
      authorization: client.handshake.headers.authorization,
      cookieHeader: client.handshake.headers.cookie,
    });

    return this.authTokenService.authenticateToken(token);
  }

  private getUserRoom(userId: ID) {
    return `user:${userId}`;
  }
}
