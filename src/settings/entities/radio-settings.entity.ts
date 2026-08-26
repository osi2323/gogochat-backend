import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class RadioSettings {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  radioLink?: string | null;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  radioRequestLink?: string | null;
}
