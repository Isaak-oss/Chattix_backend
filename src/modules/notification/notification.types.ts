export enum NotificationType {
  FRIEND_REQUEST = 'friend_request',
  FRIEND_ACCEPTED = 'friend_accepted',
  FRIEND_REJECTED = 'friend_rejected',
  FRIEND_REMOVED = 'friend_removed',
  SYSTEM = 'system',
}

export interface NotificationPayload<TData = Record<string, unknown>> {
  id: string;
  userId?: ID;
  type: NotificationType;
  title: string;
  message: string;
  data?: TData;
  readAt?: Date;
  createdAt: Date;
}

export interface NotificationsCount {
  all: number;
  read: number;
  unread: number;
}

export interface NotificationSocketPayload<TData = Record<string, unknown>> {
  data: NotificationPayload<TData>;
  count: NotificationsCount;
}

export interface NotificationUser {
  id: ID;
  email: Email;
}
