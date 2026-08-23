import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSecuritySettingsDto {
  @ApiPropertyOptional({ readOnly: true, description: 'Ignored if sent' })
  @IsOptional()
  id?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  membersMicrophoneDisabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  fakeIpLoginEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  deviceAndLocationBanEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  guestSystemEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  guestEntriesEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  guestsWritingDisabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  guestsMicrophoneDisabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  countryBlockEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'ISO country codes',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @MinLength(2, { each: true })
  blockedCountries?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  vpnBlockEnabled?: boolean;
}
