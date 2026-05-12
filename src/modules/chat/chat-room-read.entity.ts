import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '@modules/user/user.entity';
import { ChatRoom } from './chat-room.entity';
import { Message } from './message.entity';

@Entity()
@Unique(['chatRoomId', 'userId'])
export class ChatRoomRead {
  @PrimaryGeneratedColumn('uuid')
  id: ID;

  @ManyToOne(() => ChatRoom, (chatRoom) => chatRoom.readStates, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chatRoomId' })
  chatRoom: ChatRoom;

  @Column()
  chatRoomId: ID;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: ID;

  @ManyToOne(() => Message, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'lastReadMessageId' })
  lastReadMessage?: Message;

  @Column({ nullable: true })
  lastReadMessageId?: ID;

  @Column({ nullable: true })
  lastReadAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
