import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

@Entity('direct_conversations')
@Index(['user1Id', 'user2Id', 'user1IdentityKey', 'user2IdentityKey'], {
  unique: true,
})
export class DirectConversation {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user1Id' })
  user1: User;

  @Column()
  user1Id: number;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user2Id' })
  user2: User;

  @Column()
  user2Id: number;

  @Column({ type: 'varchar', length: 255, default: '' })
  user1IdentityKey: string;

  @Column({ type: 'varchar', length: 16, default: 'normal' })
  user1IdentityType: 'normal' | 'agent';

  @Column({ type: 'varchar', length: 255, default: '' })
  user2IdentityKey: string;

  @Column({ type: 'varchar', length: 16, default: 'normal' })
  user2IdentityType: 'normal' | 'agent';

  @Column({ type: 'timestamp', nullable: true })
  lastMessageAt?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  lastReadAtUser1?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  lastReadAtUser2?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  clearedAtUser1?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  clearedAtUser2?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  deletedAtUser1?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  deletedAtUser2?: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  user1DisplayName?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  user2DisplayName?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
