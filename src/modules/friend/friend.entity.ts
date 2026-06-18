import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User } from '@modules/user/user.entity';

export enum FriendStatus {
  ACCEPTED = 'accepted',
  PENDING = 'pending',
  REJECTED = 'rejected',
}

@Entity()
@Index('idx_friend_requester_status_created_at_id', ['requester', 'status', 'createdAt', 'id'])
@Index('idx_friend_receiver_status_created_at_id', ['receiver', 'status', 'createdAt', 'id'])
export class Friend {
  @PrimaryGeneratedColumn('uuid')
  id: ID;

  @ManyToOne(() => User, (user) => user, { onDelete: 'CASCADE' })
  requester: User;

  @ManyToOne(() => User, (user) => user, { onDelete: 'CASCADE' })
  receiver: User;

  @Column()
  status: FriendStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
