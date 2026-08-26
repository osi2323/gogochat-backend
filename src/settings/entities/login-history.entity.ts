import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Gender } from '../../common/enums/gender.enum';

@Entity()
export class LoginHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: User | null;

  @Column({ nullable: true })
  userId?: number | null;

  @Column({ type: 'varchar', length: 255 })
  username: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  agentNickname?: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  role: string;

  @Column({ type: 'int', nullable: true, comment: 'Giriş yapan kullanıcının yıldız sayısı (yetki düzeyi)' })
  starCount: number | null;

  @Column({ nullable: true })
  gender: Gender;

  @Column({ type: 'timestamp' })
  loginDate: Date;

  @Column({ type: 'varchar', length: 100, nullable: true })
  device: string;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  browser: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  locationCity?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  locationDistrict?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  locationCountry?: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  locationCountryCode?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  locationIsp?: string | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
