import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

export enum FriendRequestStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  CANCELED = 'CANCELED',
  BLOCKED = 'BLOCKED',
}

@Entity()
@Index(['requesterId', 'addresseeId'])
export class FriendRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  requesterId: number;

  @Column({ type: 'varchar', length: 255, default: '' })
  requesterIdentityKey: string;

  @Column({ type: 'varchar', length: 16, default: 'normal' })
  requesterIdentityType: 'normal' | 'agent';

  @Column({ type: 'varchar', length: 255, nullable: true })
  requesterDisplayName?: string | null;

  @Column()
  addresseeId: number;

  @Column({ type: 'varchar', length: 255, default: '' })
  addresseeIdentityKey: string;

  @Column({ type: 'varchar', length: 16, default: 'normal' })
  addresseeIdentityType: 'normal' | 'agent';

  @Column({ type: 'varchar', length: 255, nullable: true })
  addresseeDisplayName?: string | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requesterId' })
  requester: User;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'addresseeId' })
  addressee: User;

  @Column({
    type: 'enum',
    enum: FriendRequestStatus,
    default: FriendRequestStatus.PENDING,
  })
  status: FriendRequestStatus;

  @Column({ type: 'int', nullable: true })
  blockedById?: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
