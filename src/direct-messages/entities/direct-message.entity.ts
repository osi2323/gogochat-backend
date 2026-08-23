import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DirectConversation } from './direct-conversation.entity';
import { User } from '../../user/entities/user.entity';

@Entity('direct_messages')
export class DirectMessage {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => DirectConversation, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversationId' })
  conversation: DirectConversation;

  @Column()
  conversationId: number;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'senderId' })
  sender: User;

  @Column()
  senderId: number;

  @Column({ type: 'varchar', length: 255, default: '' })
  senderIdentityKey: string;

  @Column({ type: 'varchar', length: 16, default: 'normal' })
  senderIdentityType: 'normal' | 'agent';

  @Column({ type: 'text', nullable: true })
  content?: string | null;

  @Column({ type: 'text', nullable: true })
  image?: string | null;

  @Column({ type: 'text', nullable: true })
  audio?: string | null;

  @Column({ type: 'varchar', nullable: true })
  audioFileName?: string | null;

  @ManyToOne(() => DirectMessage, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'replyToMessageId' })
  replyToMessage?: DirectMessage | null;

  @Column({ nullable: true })
  replyToMessageId?: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  senderDisplayName?: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
