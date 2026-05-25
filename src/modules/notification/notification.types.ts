import { ApiProperty } from '@nestjs/swagger';

export enum NotificationType {
  FRIEND_REQUEST = 'friend_request',
  FRIEND_ACCEPTED = 'friend_accepted',
  FRIEND_REJECTED = 'friend_rejected',
  FRIEND_REMOVED = 'friend_removed',
  SYSTEM = 'system',
}

export class NotificationCountResponseDto {
  @ApiProperty()
  all: number;

  @ApiProperty()
  read: number;

  @ApiProperty()
  unread: number;
}

export class DeleteNotificationResponseDto {
  @ApiProperty()
  raw: unknown;

  @ApiProperty({ required: false, nullable: true })
  affected?: number;
}

export class NotificationResponseDto {
  @ApiProperty()
  id: ID;

  @ApiProperty()
  userId: ID;

  @ApiProperty({ enum: NotificationType })
  type: NotificationType;

  @ApiProperty()
  title: string;

  @ApiProperty()
  message: string;

  @ApiProperty({ required: false, additionalProperties: true })
  data?: Record<string, unknown>;

  @ApiProperty({ required: false })
  readAt?: Date;

  @ApiProperty()
  createdAt: Date;
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
