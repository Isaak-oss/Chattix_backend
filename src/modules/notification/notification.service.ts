import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NotificationGateway } from './notification.gateway';
import { NotificationPayload, NotificationType } from './notification.types';

interface CreateNotificationParams<TData = Record<string, unknown>> {
  type: NotificationType;
  title: string;
  message: string;
  data?: TData;
}

@Injectable()
export class NotificationService {
  constructor(private readonly notificationGateway: NotificationGateway) {}

  notifyUser<TData = Record<string, unknown>>(userId: ID, params: CreateNotificationParams<TData>) {
    const notification = this.createNotification(params);
    this.notificationGateway.emitToUser(userId, notification);
    return notification;
  }

  notifyUsers<TData = Record<string, unknown>>(
    userIds: ID[],
    params: CreateNotificationParams<TData>,
  ) {
    const notification = this.createNotification(params);
    this.notificationGateway.emitToUsers(userIds, notification);
    return notification;
  }

  notifyFriendRequest(receiverId: ID, requesterId: ID, requestId: ID) {
    return this.notifyUser(receiverId, {
      type: NotificationType.FRIEND_REQUEST,
      title: 'New friend request',
      message: 'You have a new friend request',
      data: { requesterId, requestId },
    });
  }

  notifyFriendAccepted(requesterId: ID, receiverId: ID, requestId: ID) {
    return this.notifyUser(requesterId, {
      type: NotificationType.FRIEND_ACCEPTED,
      title: 'Friend request accepted',
      message: 'Your friend request was accepted',
      data: { receiverId, requestId },
    });
  }

  notifyFriendRejected(requesterId: ID, receiverId: ID, requestId: ID) {
    return this.notifyUser(requesterId, {
      type: NotificationType.FRIEND_REJECTED,
      title: 'Friend request rejected',
      message: 'Your friend request was rejected',
      data: { receiverId, requestId },
    });
  }

  notifyFriendRemoved(userId: ID, removedByUserId: ID, relationId: ID) {
    return this.notifyUser(userId, {
      type: NotificationType.FRIEND_REMOVED,
      title: 'Friend removed',
      message: 'A friend relation was removed',
      data: { removedByUserId, relationId },
    });
  }

  notifyNewMessage(receiverId: ID, senderId: ID, messageId: ID, preview?: string) {
    return this.notifyUser(receiverId, {
      type: NotificationType.MESSAGE,
      title: 'New message',
      message: preview || 'You have a new message',
      data: { senderId, messageId },
    });
  }

  notifySystem<TData = Record<string, unknown>>(
    params: Omit<CreateNotificationParams<TData>, 'type'>,
    userIds?: ID[],
  ) {
    const notification = this.createNotification({
      ...params,
      type: NotificationType.SYSTEM,
    });

    if (userIds?.length) {
      this.notificationGateway.emitToUsers(userIds, notification);
    } else {
      this.notificationGateway.emitSystem(notification);
    }

    return notification;
  }

  isUserOnline(userId: ID) {
    return this.notificationGateway.isOnline(userId);
  }

  private createNotification<TData = Record<string, unknown>>(
    params: CreateNotificationParams<TData>,
  ): NotificationPayload<TData> {
    return {
      id: randomUUID(),
      type: params.type,
      title: params.title,
      message: params.message,
      data: params.data,
      createdAt: new Date().toISOString(),
    };
  }
}
