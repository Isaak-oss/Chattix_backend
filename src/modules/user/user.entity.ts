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

  @Column({ default: new Date() })
  lastSeen: Date;

  @OneToMany(() => Post, (post) => post.author)
  posts: Post[];

  @OneToMany(() => Friend, (friend) => friend.requester)
  sentRequests: Friend[];

  @OneToMany(() => Friend, (friend) => friend.receiver)
  receivedRequests: Friend[];

  @ManyToMany(() => ChatRoom, (chatRoom) => chatRoom.participants)
  chatRooms: ChatRoom[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
