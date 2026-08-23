import {
  Column,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Gender } from '../../common/enums/gender.enum';
import { Role } from '../../role/entities/role.entity';
import { StatusMode } from '../../status-mode/entities/status-mode.entity';
import {
  defaultChatPreferences,
  type ChatPreferences,
} from '../chat-preferences.constants';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  username: string;

  @Column()
  password: string;

  @Column({
    type: 'boolean',
    default: false,
    comment: 'Geçici misafir kullanıcı mı',
  })
  isGuest: boolean;

  @Column({
    type: 'timestamp',
    nullable: true,
    comment: 'Misafir kullanıcı son geçerlilik tarihi',
  })
  guestExpiresAt: Date | null;

  @Column()
  gender: Gender;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    comment: 'Kullanıcı profil çerçevesi bilgisi',
  })
  frame?: string | null;

  @Column({
    type: 'text',
    nullable: true,
    comment: 'Kullanıcı profil ikonu bilgisi',
  })
  icon?: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    comment: 'Kullanıcı yazı tipi adı',
  })
  fontName?: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    comment: 'Kullanıcı granit bilgisi',
  })
  granite?: string | null;

  @Column({
    type: 'varchar',
    length: 7,
    nullable: true,
    comment: 'Kullanıcı rumuz rengi (hex)',
  })
  nickColor?: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    comment: 'Kullanıcı profilde gösterilecek user gif bilgisi',
  })
  userGif?: string | null;

  @Column({
    type: 'text',
    nullable: true,
    comment: 'Kullanıcının flash nick görseli (data URL)',
  })
  flashNick?: string | null;

  @Column({
    type: 'boolean',
    default: false,
    comment: 'Kullanıcı hesabını dondurdu mu',
  })
  accountFrozen: boolean;

  @Column({
    type: 'timestamp',
    nullable: true,
    comment: 'Hesabın dondurulduğu tarih',
  })
  accountFrozenAt: Date | null;

  @Column({
    type: 'int',
    default: 0,
    comment: 'Hesap kilidini uygulayan kullanıcının yıldız sayısı',
  })
  accountFrozenByStarCount: number;

  @Column({
    type: 'varchar',
    length: 64,
    nullable: true,
    comment: 'Kullanıcı giriş efekti bilgisi',
  })
  joinEffect?: string | null;

  @Column({
    type: 'boolean',
    default: false,
    comment: 'Kullanıcı koruma durumu',
  })
  protection: boolean;

  @Column({
    type: 'int',
    default: 0,
    comment: 'Korumayı sağlayan yetkilinin yıldız sayısı',
  })
  protectedByStarCount: number;

  @Column({
    type: 'boolean',
    default: false,
    comment: 'Kullanıcı mikrofon yasak durumu',
  })
  micBanned: boolean;

  @Column({
    type: 'int',
    default: 0,
    comment: 'Mikrofon yasağını sağlayan yetkilinin yıldız sayısı',
  })
  micBannedByStarCount: number;

  @Column({
    type: 'boolean',
    default: false,
    comment: 'Kullanıcı kamera yasak durumu',
  })
  cameraBanned: boolean;

  @Column({
    type: 'int',
    default: 0,
    comment: 'Kamera yasağını sağlayan yetkilinin yıldız sayısı',
  })
  cameraBannedByStarCount: number;

  @Column({
    type: 'boolean',
    default: false,
    comment: 'Kullanıcı tüm odalarda susturulmuş mu',
  })
  globalMuted: boolean;

  @Column({
    type: 'int',
    default: 0,
    comment: 'Tüm odalarda susturma işlemini uygulayan yetkilinin yıldız sayısı',
  })
  globalMutedByStarCount: number;

  @Column({
    type: 'timestamp',
    nullable: true,
    comment: 'Üyelik bitiş tarihi',
  })
  membershipExpiresAt: Date | null;

  @Column({
    type: 'jsonb',
    default: () => "'[]'::jsonb",
    comment: 'Kullanıcıya özel izinler',
  })
  permissions: string[];

  @Column({
    type: 'jsonb',
    default: () => `'${JSON.stringify(defaultChatPreferences)}'::jsonb`,
    comment: 'Kullanıcı sohbet tercihleri',
  })
  chatPreferences: ChatPreferences;

  @ManyToOne(() => Role, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'roleId' })
  role: Role | null;

  @Column({ nullable: true })
  roleId: number | null;

  @ManyToOne(() => StatusMode, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'statusModeId' })
  statusMode: StatusMode | null;

  @Column({ nullable: true })
  statusModeId: number | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt: Date | null;

  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  deletedAt: Date;
}
