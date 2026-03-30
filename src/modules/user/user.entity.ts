import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { Post } from '../post/post.entity';
import { Exclude } from 'class-transformer';

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: ID;

  @Column({ unique: true })
  email: Email;

  @Column({ nullable: true, select: false })
  @Exclude()
  password?: string;

  @Column({ nullable: true })
  name?: string;

  @Column({ nullable: true })
  bio?: string;

  @Column({ default: new Date() })
  lastSeen: Date;

  @OneToMany(() => Post, (post) => post.author)
  posts: Post[];
}
