import {
  Column,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  OneToMany,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

@Entity()
export class Role {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'int', comment: 'Mikrofon süresi (saniye)' })
  microphoneDuration: number;

  @Column({ comment: 'Rütbe yıldız rengi (hex color)' })
  starColor: string;

  @Column({ type: 'int', comment: 'Yıldız sayısı' })
  starCount: number;

  @Column({ type: 'text', nullable: true, comment: 'Icon string identifier' })
  icon: string | null;

  @Column({ type: 'jsonb', default: '{}', comment: 'Permission flags' })
  permissions: Record<string, boolean>;

  @OneToMany(() => User, (user) => user.role)
  users: User[];

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  deletedAt: Date;
}
