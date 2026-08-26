import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('bots')
export class Bot {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  username: string;

  @Column({ type: 'enum', enum: ['male', 'female'], default: 'female' })
  gender: 'male' | 'female';

  @Column({ nullable: true })
  role: string;

  @Column({ type: 'text', nullable: true })
  avatar: string;

  @Column({ nullable: true })
  status: string;

  @Column({ nullable: true })
  room: string;

  @Column({ nullable: true })
  userGif: string;

  @Column({ nullable: true })
  statusMode: string;

  @Column({ nullable: true })
  loginType: string;

  @Column({ nullable: true })
  messagePermission: string;

  @Column({ type: 'text', nullable: true })
  welcomeMessage: string | null;

  @Column({ default: true })
  welcomeAutoSendEnabled: boolean;

  @Column({ default: false })
  welcomeManualPromptEnabled: boolean;

  @Column({ default: false })
  isAI: boolean;

  @Column({ type: 'text', nullable: true })
  extraInfo: string;

  @Column({ nullable: true })
  fontName: string;

  @Column({ nullable: true })
  granite: string;

  @Column({ default: false })
  roomMuted: boolean;

  @Column({ type: 'varchar', nullable: true })
  roomMutedRoomKey: string | null;

  @Column({ default: false })
  globalMuted: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
