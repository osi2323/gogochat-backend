import {
  Column,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

@Entity('rooms')
export class Room {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ comment: 'Oda adı' })
  name: string;

  @Column({ type: 'varchar', nullable: true })
  voiceId?: string | null;

  @Column({ type: 'boolean', default: true })
  isEditable: boolean;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'ownerId' })
  owner?: User;

  @Column({ nullable: true })
  ownerId?: number;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'int', default: 200 })
  maxUsers: number;

  @Column({ type: 'int', default: 15 })
  visibleUserCount: number;

  @Column({ type: 'boolean', default: false })
  isPrivate: boolean;

  @Column({ type: 'varchar', nullable: true })
  password?: string | null;

  @Column({ type: 'varchar', nullable: true })
  radioPanelLink?: string | null;

  @Column({ type: 'varchar', nullable: true })
  radioRequestLink?: string | null;

  @Column({ type: 'int' })
  listOrder: number;

  @Column({ type: 'int', default: 0 })
  minStar: number;

  @Column({ type: 'varchar', nullable: true })
  backgroundColor?: string | null;

  @Column({ type: 'varchar', nullable: true })
  roomImage?: string | null;

  @Column({ type: 'varchar', nullable: true })
  logo?: string | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  deletedAt?: Date | null;
}
