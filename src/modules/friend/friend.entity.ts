import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn } from 'typeorm';
import { User } from '@modules/user/user.entity';

export enum FriendStatus {
  ACCEPTED = 'accepted',
  PENDING = 'pending',
  REJECTED = 'rejected',
}

@Entity()
export class Friend {
  @PrimaryGeneratedColumn('uuid')
  id: ID;

  @ManyToOne(() => User, (user) => user, { onDelete: 'CASCADE' })
  requester: User;

  @ManyToOne(() => User, (user) => user, { onDelete: 'CASCADE' })
  receiver: User;

  @Column()
  status: FriendStatus;

  @CreateDateColumn()
  createdAt: Date;
}
