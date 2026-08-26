import { ApiProperty } from '@nestjs/swagger';

export class SecuritySettingsResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty()
  membersMicrophoneDisabled: boolean;

  @ApiProperty()
  fakeIpLoginEnabled: boolean;

  @ApiProperty()
  deviceAndLocationBanEnabled: boolean;

  @ApiProperty()
  guestSystemEnabled: boolean;

  @ApiProperty()
  guestEntriesEnabled: boolean;

  @ApiProperty()
  guestsWritingDisabled: boolean;

  @ApiProperty()
  guestsMicrophoneDisabled: boolean;

  @ApiProperty()
  countryBlockEnabled: boolean;

  @ApiProperty({ type: [String], example: ['TR', 'US'] })
  blockedCountries: string[];

  @ApiProperty()
  vpnBlockEnabled: boolean;
}
