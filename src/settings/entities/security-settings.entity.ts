import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class SecuritySettings {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ default: false })
  membersMicrophoneDisabled: boolean;

  @Column({ default: false })
  fakeIpLoginEnabled: boolean;

  @Column({ default: false })
  deviceAndLocationBanEnabled: boolean;

  @Column({ default: false })
  guestSystemEnabled: boolean;

  @Column({ default: false })
  guestEntriesEnabled: boolean;

  @Column({ default: false })
  guestsWritingDisabled: boolean;

  @Column({ default: false })
  guestsMicrophoneDisabled: boolean;

  @Column({ default: false })
  countryBlockEnabled: boolean;

  @Column({ type: 'simple-json', default: '[]' })
  blockedCountries: string[];

  @Column({ default: false })
  vpnBlockEnabled: boolean;
}
