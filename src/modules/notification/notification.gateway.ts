import { Injectable, OnModuleInit } from '@nestjs/common';
import { AuthenticatedSocket } from '@common/gateways/authenticated.gateway';
import { RealtimeEventsService } from '@common/gateways/realtime-events.service';
import {
  NotificationPayload,
  NotificationSocketPayload,
  NotificationUser,
} from './notification.types';

type NotificationSocket = AuthenticatedSocket<NotificationUser>;

@Injectable()
export class NotificationGateway implements OnModuleInit {
  constructor(private readonly realtimeEvents: RealtimeEventsService) {}

  onModuleInit() {
    this.realtimeEvents.registerHandler('notifications:ping', (client, body) =>
      this.handlePing(client as NotificationSocket, body),
    );
  }

  handlePing(client: NotificationSocket, body: unknown) {
    client.emit('notifications:pong', {
      userId: client.user?.id,
      data: body ?? null,
      createdAt: new Date().toISOString(),
    });
  }

  emitToUser(userId: ID, payload: NotificationSocketPayload<unknown>) {
    this.realtimeEvents.emitToUser(userId, 'notifications:new', payload);
  }

  emitToUsers(userIds: ID[], payload: NotificationSocketPayload<unknown>) {
    this.realtimeEvents.emitToUsers(userIds, 'notifications:new', payload);
  }

  emitSystem(notification: NotificationPayload<unknown>) {
    this.realtimeEvents.emitSystem('notifications:new', {
      data: notification,
      meta: {
        notificationsCount: 0,
      },
    });
  }

  isOnline(userId: ID) {
    return this.realtimeEvents.isOnline(userId);
  }
}
