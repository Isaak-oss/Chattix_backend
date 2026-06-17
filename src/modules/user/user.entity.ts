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

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: ID;

  @Column({ unique: true })
  email: Email;

  @Column({ nullable: true, select: false })
  @Exclude()
  password?: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  bio?: string;

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
