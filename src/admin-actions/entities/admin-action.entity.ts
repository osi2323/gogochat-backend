import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

@Entity()
export class AdminAction {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'adminId' })
  admin?: User | null;

  @Column({ type: 'int', nullable: true })
  adminId?: number | null;

  @Column({ type: 'varchar', length: 100 })
  actionType: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'int', nullable: true })
  targetUserId?: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  targetUsername?: string | null;

  @Column({ type: 'varchar', length: 50, default: 'COMPLETED' })
  status: string;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any> | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
