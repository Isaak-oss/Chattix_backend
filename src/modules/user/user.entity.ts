import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToMany,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Post } from '../post/post.entity';
import { Exclude } from 'class-transformer';
import { Friend } from '@modules/friend/friend.entity';
import { ChatRoom } from '@modules/chat/chat-room.entity';
import { Notification } from '@modules/notification/notification.entity';

export enum ProfileVisibility {
  PUBLIC = 'public',
  FRIENDS_ONLY = 'friendsOnly',
  PRIVATE = 'private',
}

export enum WhoCanMessage {
  EVERYONE = 'everyone',
  FRIENDS_ONLY = 'friendsOnly',
}

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: ID;

  @Column({ unique: true })
  email: Email;

  @Column({ nullable: true, select: false })
  @Exclude()
  password?: string;

  @Column({ name: 'name' })
  fullName: string;

  @Column()
  username?: string;

  @Column({ nullable: true })
  bio?: string;

  @Column({
    type: 'enum',
    enum: ProfileVisibility,
    enumName: 'user_profile_visibility_enum',
    default: ProfileVisibility.PUBLIC,
  })
  profileVisibility: ProfileVisibility;

  @Column({
    type: 'enum',
    enum: WhoCanMessage,
    enumName: 'user_who_can_message_enum',
    default: WhoCanMessage.EVERYONE,
  })
  whoCanMessage: WhoCanMessage;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  lastSeenAt: Date;

  @OneToMany(() => Post, (post) => post.author)
  posts: Post[];

  @OneToMany(() => Friend, (friend) => friend.requester)
  sentRequests: Friend[];

  @OneToMany(() => Friend, (friend) => friend.receiver)
  receivedRequests: Friend[];

  @OneToMany(() => Notification, (notification) => notification.user)
  notifications: Notification[];

  @ManyToMany(() => ChatRoom, (chatRoom) => chatRoom.participants)
  chatRooms: ChatRoom[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
