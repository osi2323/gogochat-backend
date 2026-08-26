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

export enum ProfileCommentStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
}

@Entity('profile_comments')
export class ProfileComment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'targetUserId' })
  targetUser: User;

  @Column()
  targetUserId: number;

  @Column({ type: 'varchar', length: 255, default: '' })
  targetIdentityKey: string;

  @Column({ type: 'varchar', length: 16, default: 'normal' })
  targetIdentityType: 'normal' | 'agent';

  @Column({ type: 'varchar', length: 255, nullable: true })
  targetDisplayName?: string | null;

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

  @Column({ type: 'text' })
  content: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: ProfileCommentStatus.PENDING,
  })
  status: ProfileCommentStatus;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'approvedByUserId' })
  approvedByUser?: User | null;

  @Column({ nullable: true })
  approvedByUserId: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt?: Date | null;
}
