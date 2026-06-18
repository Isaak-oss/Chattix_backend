import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '@modules/user/user.entity';
import { ChatRoom } from './chat-room.entity';

@Entity()
@Index('idx_message_chat_room_created_at_id', ['chatRoomId', 'createdAt', 'id'])
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: ID;

  @Column({ type: 'text' })
  content: string;

  @ManyToOne(() => ChatRoom, (chatRoom) => chatRoom.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chatRoomId' })
  chatRoom: ChatRoom;

  @Column()
  chatRoomId: ID;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'senderId' })
  sender: User;

  @Column()
  senderId: ID;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
