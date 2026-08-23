import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('room_message_visibility_sessions')
@Index(['userId', 'identityKey', 'roomId'])
@Index(['socketId'])
export class RoomMessageVisibilitySession {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column({ type: 'varchar', length: 255, default: '' })
  identityKey: string;

  @Column()
  roomId: number;

  @Column({ type: 'timestamp' })
  joinedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  leftAt?: Date | null;

  @Column({ type: 'int', default: 0 })
  joinedAfterMessageId: number;

  @Column({ type: 'int', nullable: true })
  leftMessageId?: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  socketId?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
