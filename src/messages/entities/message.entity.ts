import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Room } from '../../rooms/entities/room.entity';
import { MessageType } from '../enums/message-type.enum';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
  content: string;

  @Column({
    type: 'text',
    default: MessageType.NORMAL,
  })
  type: MessageType;

  @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ nullable: true })
  userId: number | null;

  @Column({ type: 'varchar', length: 255, default: '' })
  senderIdentityKey: string;

  @Column({ type: 'varchar', length: 16, default: 'normal' })
  senderIdentityType: 'normal' | 'agent';

  @Column({ type: 'varchar', length: 255, nullable: true })
  senderPublicName?: string | null;

  @ManyToOne(() => Room, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roomId' })
  room: Room;

  @Column()
  roomId: number;

  @ManyToOne(() => Message, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'replyToMessageId' })
  replyToMessage?: Message | null;

  @Column({ nullable: true })
  replyToMessageId?: number | null;

  @Column({ type: 'text', nullable: true })
  image?: string | null;

  @Column({ type: 'text', nullable: true })
  audio?: string | null;

  @Column({ type: 'varchar', nullable: true })
  audioFileName?: string | null;

  @Column({ type: 'varchar', nullable: true })
  fontColor?: string | null;

  @Column({ type: 'varchar', nullable: true })
  userFontName?: string | null;

  @Column({ type: 'varchar', nullable: true })
  userGranite?: string | null;

  @Column({ type: 'varchar', nullable: true })
  userNickColor?: string | null;

  @Column({ type: 'varchar', nullable: true })
  targetGroup?: string | null;

  @Column({ type: 'int', nullable: true })
  botId?: number | null;

  @Column({ type: 'varchar', nullable: true })
  botUsername?: string | null;

  @Column({ type: 'varchar', nullable: true })
  botSpeakerUsername?: string | null;

  @Column({ type: 'varchar', nullable: true })
  botSpeakerDisplayName?: string | null;

  @Column({ type: 'text', nullable: true })
  botAvatar?: string | null;

  @Column({ type: 'varchar', nullable: true })
  botGender?: 'male' | 'female' | null;

  @Column({ type: 'varchar', nullable: true })
  botFontName?: string | null;

  @Column({ type: 'varchar', nullable: true })
  botGranite?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt?: Date | null;
}
