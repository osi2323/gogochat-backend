import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateRadioSettingsDto {
  @ApiPropertyOptional({ readOnly: true, description: 'Ignored if sent' })
  @IsOptional()
  @IsInt()
  @Min(1)
  id?: number;

  @ApiPropertyOptional({ description: 'Radyo yayın linki' })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  radioLink?: string | null;

  @ApiPropertyOptional({ description: 'Radyo istek paneli linki' })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  radioRequestLink?: string | null;
}
