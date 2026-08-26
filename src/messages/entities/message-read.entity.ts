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
import { Message } from './message.entity';

@Entity('message_reads')
@Unique(['messageId', 'userId', 'identityKey'])
@Index(['userId', 'identityKey', 'messageId'])
export class MessageRead {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Message, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'messageId' })
  message: Message;

  @Column()
  messageId: number;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: number;

  @Column({ type: 'varchar', length: 255, default: '' })
  identityKey: string;

  @CreateDateColumn()
  readAt: Date;
}
