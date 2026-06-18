import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../user/user.entity';

@Entity()
@Index('idx_post_created_at_id', ['createdAt', 'id'])
@Index('idx_post_author_created_at_id', ['authorId', 'createdAt', 'id'])
export class Post {
  @PrimaryGeneratedColumn('uuid')
  id: ID;

  @Column({ type: 'text', nullable: true })
  content: string;

  @Column({ default: false })
  isPublished: boolean;

  @ManyToOne(() => User, (user) => user.posts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'authorId' })
  author: User;

  @Column()
  authorId: ID;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
