import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { AuthTokenService } from '@modules/auth/auth-token.service';
import { AuthenticatedGateway, AuthenticatedSocket } from '@common/gateways/authenticated.gateway';
import { NotificationPayload, NotificationUser } from './notification.types';

type NotificationSocket = AuthenticatedSocket<NotificationUser>;

@WebSocketGateway({
  namespace: 'notifications',
  cors: {
    origin: process.env.GATEWAY_ORIGIN?.split(','),
    credentials: true,
  },
})
export class NotificationGateway extends AuthenticatedGateway<NotificationUser> {
  constructor(authTokenService: AuthTokenService) {
    super(authTokenService, 'notifications');
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
    this.emitGatewayEventToUser(userId, 'notifications:new', notification);
  }

  emitToUsers(userIds: ID[], notification: NotificationPayload<unknown>) {
    this.emitGatewayEventToUsers(userIds, 'notifications:new', notification);
  }

  emitSystem(notification: NotificationPayload<unknown>) {
    this.emitGatewayEventSystem('notifications:new', notification);
  }

  isOnline(userId: ID) {
    return this.isUserOnline(userId);
  }
}
