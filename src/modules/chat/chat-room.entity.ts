import {
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from '@modules/user/user.entity';
import { ChatRoomRead } from './chat-room-read.entity';
import { Message } from './message.entity';

export enum ChatRoomType {
  DIRECT = 'direct',
  GROUP = 'group',
}

@Entity()
@Index(['directKey'], { unique: true, where: '"directKey" IS NOT NULL' })
export class ChatRoom {
  @PrimaryGeneratedColumn('uuid')
  id: ID;

  @Column({ nullable: true })
  name?: string;

  @Column({ type: 'enum', enum: ChatRoomType, nullable: true })
  type?: ChatRoomType;

  @Column({ nullable: true, select: false })
  directKey?: string;

  @ManyToMany(() => User, (user) => user.chatRooms, { onDelete: 'CASCADE' })
  @JoinTable()
  participants: User[];

  @OneToMany(() => Message, (message) => message.chatRoom)
  messages: Message[];

  lastMessage?: Message;

  unreadMessagesCount?: number;

  @OneToMany(() => ChatRoomRead, (readState) => readState.chatRoom)
  readStates: ChatRoomRead[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
