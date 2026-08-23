import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { WallPost } from './wall-post.entity';

@Entity('wall_post_likes')
@Index(['wallPostId', 'userId'], { unique: true })
export class WallPostLike {
  @PrimaryGeneratedColumn()
  id: number;

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

  @CreateDateColumn()
  createdAt: Date;
}
