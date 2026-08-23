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

@Entity('wall_post_views')
@Index(['wallPostId', 'userId', 'identityKey'])
export class WallPostView {
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

  @Column({ type: 'varchar', length: 255, default: '' })
  identityKey: string;

  @Column({ type: 'varchar', length: 16, default: 'normal' })
  identityType: 'normal' | 'agent';

  @Column({ type: 'varchar', length: 255, nullable: true })
  identityPublicName?: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
