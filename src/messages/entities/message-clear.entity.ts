import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Room } from '../../rooms/entities/room.entity';

@Entity('message_clears')
@Unique(['userId', 'roomId', 'identityKey'])
@Index(['userId', 'identityKey', 'roomId'])
export class MessageClear {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: number;

  @Column({ type: 'varchar', length: 255, default: '' })
  identityKey: string;

  @ManyToOne(() => Room, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roomId' })
  room: Room;

  @Column()
  roomId: number;

  @CreateDateColumn()
  clearedAt: Date;

  @Column({ type: 'int', nullable: true })
  lastClearedMessageId?: number | null;
}
