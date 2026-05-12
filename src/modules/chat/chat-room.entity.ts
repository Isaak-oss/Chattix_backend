import {
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '@modules/user/user.entity';
import { ChatRoomRead } from './chat-room-read.entity';
import { Message } from './message.entity';

@Entity()
export class ChatRoom {
  @PrimaryGeneratedColumn('uuid')
  id: ID;

  @Column({ nullable: true })
  name?: string;

  @ManyToMany(() => User, (user) => user.chatRooms, { onDelete: 'CASCADE' })
  @JoinTable()
  participants: User[];

  @OneToMany(() => Message, (message) => message.chatRoom)
  messages: Message[];

  @OneToMany(() => ChatRoomRead, (readState) => readState.chatRoom)
  readStates: ChatRoomRead[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
