import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

export type CallHistoryDirection = 'incoming' | 'outgoing';
export type CallHistoryStatus =
  | 'missed'
  | 'completed'
  | 'rejected'
  | 'canceled';

@Entity('call_history')
@Index(['tenantId', 'userId', 'agentNickname', 'startedAt'])
export class CallHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  tenantId: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'int' })
  userId: number;

  @Column({ type: 'varchar', length: 255, default: '' })
  agentNickname: string;

  @Column({ type: 'varchar', length: 255 })
  callId: string;

  @Column({ type: 'varchar', length: 255 })
  peerName: string;

  @Column({ type: 'varchar', length: 20 })
  direction: CallHistoryDirection;

  @Column({ type: 'varchar', length: 20 })
  status: CallHistoryStatus;

  @Column({ type: 'timestamp' })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  endedAt?: Date | null;

  @Column({ type: 'int', nullable: true })
  durationSec?: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt?: Date | null;
}
