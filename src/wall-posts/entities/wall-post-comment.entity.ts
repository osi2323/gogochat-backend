import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { WallPost } from './wall-post.entity';

@Entity('wall_post_comments')
export class WallPostComment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
  content: string;

  @ManyToOne(() => WallPost, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'wallPostId' })
  wallPost: WallPost;

  @Column()
  wallPostId: number;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: number;

  @Column({ type: 'varchar', length: 255, default: '' })
  authorIdentityKey: string;

  @Column({ type: 'varchar', length: 16, default: 'normal' })
  authorIdentityType: 'normal' | 'agent';

  @Column({ type: 'varchar', length: 255, nullable: true })
  authorDisplayName?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt?: Date | null;
}
