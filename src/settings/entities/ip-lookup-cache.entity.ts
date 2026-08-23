import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class IpLookupCache {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 45, unique: true })
  ipAddress: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  countryCode: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  country: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  regionName: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  district: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  isp: string | null;

  @Column({ type: 'boolean', nullable: true })
  isProxy: boolean | null;

  @Column({ type: 'boolean', nullable: true })
  isHosting: boolean | null;

  @Column({ type: 'jsonb', nullable: true })
  rawResponse: Record<string, unknown> | null;

  @Column({ type: 'timestamp' })
  fetchedAt: Date;

  @Column({ type: 'timestamp' })
  expiresAt: Date;
}
