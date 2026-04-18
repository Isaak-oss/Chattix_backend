import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn } from 'typeorm';
import { User } from '@modules/user/user.entity';

@Entity()
export class Friend {
  @PrimaryGeneratedColumn('uuid')
  id: ID;

  @ManyToOne(() => User, (user) => user, { onDelete: 'CASCADE' })
  requester: User;

  @ManyToOne(() => User, (user) => user, { onDelete: 'CASCADE' })
  receiver: User;

  @Column({ default: 'pending' })
  status: 'pending' | 'accepted' | 'rejected';

  @CreateDateColumn()
  createdAt: Date;
}
