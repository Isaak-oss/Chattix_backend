export enum NotificationType {
  FRIEND_REQUEST = 'friend_request',
  FRIEND_ACCEPTED = 'friend_accepted',
  FRIEND_REJECTED = 'friend_rejected',
  FRIEND_REMOVED = 'friend_removed',
  MESSAGE = 'message',
  SYSTEM = 'system',
}

export interface NotificationPayload<TData = Record<string, unknown>> {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: TData;
  createdAt: string;
}

export interface NotificationUser {
  id: ID;
  email: Email;
}
