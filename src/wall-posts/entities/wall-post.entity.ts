import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { WallPostVisibility } from '../enums/wall-post-visibility.enum';

@Entity('wall_posts')
export class WallPost {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text', nullable: true })
  content: string | null;

  @Column({ type: 'text', nullable: true })
  image: string | null;

  @Column({ type: 'varchar', length: 7, nullable: true })
  backgroundColor: string | null;

  @Column({
    type: 'text',
    default: WallPostVisibility.MEMBERS,
  })
  visibility: WallPostVisibility;

  @Column({ type: 'int', default: 0 })
  likeCount: number;

  @Column({ type: 'int', default: 0 })
  commentCount: number;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: number;

  @Column({ type: 'varchar', length: 255, default: '' })
  senderIdentityKey: string;

  @Column({ type: 'varchar', length: 16, default: 'normal' })
  senderIdentityType: 'normal' | 'agent';

  @Column({ type: 'varchar', length: 255, nullable: true })
  senderPublicName?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt?: Date | null;
}
