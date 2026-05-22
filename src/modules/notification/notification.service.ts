import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { paginate } from '@common/lib/paginate/paginate';
import { PaginationDto } from '@common/lib/paginate/paginate.dto';
import { Notification } from './notification.entity';
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
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    private readonly notificationGateway: NotificationGateway,
  ) {}

  getMyNotifications(userId: ID, paginationDto: PaginationDto) {
    const qb = this.notificationRepository
      .createQueryBuilder('notification')
      .where('notification.userId = :userId', { userId })
      .orderBy('notification.createdAt', 'DESC');

    return paginate(qb, paginationDto);
  }

  async getNotificationsCount(userId: ID) {
    const result = await this.notificationRepository
      .createQueryBuilder('notification')
      .select('COUNT(*)', 'all')
      .addSelect('COUNT(CASE WHEN notification.readAt IS NOT NULL THEN 1 END)', 'read')
      .addSelect('COUNT(CASE WHEN notification.readAt IS NULL THEN 1 END)', 'unread')
      .where('notification.userId = :userId', { userId })
      .getRawOne();

    return {
      all: Number(result.all),
      read: Number(result.read),
      unread: Number(result.unread),
    };
  }

  deleteMyNotification(notificationId: ID) {
    return this.notificationRepository.delete(notificationId);
  }

  async markAsRead(userId: ID, notificationId: ID) {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    notification.readAt ??= new Date();

    return this.notificationRepository.save(notification);
  }

  async notifyUser<TData = Record<string, unknown>>(
    userId: ID,
    params: CreateNotificationParams<TData>,
  ) {
    const notification = await this.createNotification(userId, params);
    await this.emitNotification(notification);
    return notification;
  }

  async notifyUsers<TData = Record<string, unknown>>(
    userIds: ID[],
    params: CreateNotificationParams<TData>,
  ) {
    const notifications = await Promise.all(
      userIds.map((userId) => this.createNotification(userId, params)),
    );

    await Promise.all(notifications.map((notification) => this.emitNotification(notification)));

    return notifications;
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

  async notifySystem<TData = Record<string, unknown>>(
    params: Omit<CreateNotificationParams<TData>, 'type'>,
    userIds?: ID[],
  ) {
    const notification = {
      ...params,
      type: NotificationType.SYSTEM,
    };

    if (userIds?.length) {
      return this.notifyUsers(userIds, notification);
    }

    this.notificationGateway.emitSystem({
      id: 'system',
      ...notification,
      createdAt: new Date(),
    });
  }

  isUserOnline(userId: ID) {
    return this.notificationGateway.isOnline(userId);
  }

  private async createNotification<TData = Record<string, unknown>>(
    userId: ID,
    params: CreateNotificationParams<TData>,
  ): Promise<NotificationPayload<TData> & { userId: ID }> {
    const notification = await this.notificationRepository.save(
      this.notificationRepository.create({
        userId,
        type: params.type,
        title: params.title,
        message: params.message,
        data: params.data as Record<string, unknown> | undefined,
      }),
    );

    return {
      ...notification,
      data: notification.data as TData | undefined,
    };
  }

  private async emitNotification<TData = Record<string, unknown>>(
    notification: NotificationPayload<TData> & { userId: ID },
  ) {
    const count = await this.getNotificationsCount(notification.userId);

    this.notificationGateway.emitToUser(notification.userId, {
      data: notification,
      count,
    });
  }
}
