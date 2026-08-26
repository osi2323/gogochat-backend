import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateRoomDto {
  @ApiProperty({ description: 'Oda adı' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Oda sahibinin kullanıcı adı' })
  @IsOptional()
  @IsString()
  ownerName?: string;

  @ApiPropertyOptional({ description: 'Oda açıklaması' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Maksimum kullanıcı sayısı',
    default: 200,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  maxUsers = 200;

  @ApiPropertyOptional({
    description: 'Odada gösterilecek kullanıcı sayısı',
    default: 15,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  visibleUserCount = 15;

  @ApiPropertyOptional({
    description: 'Aynı anda mikrofonda bulunabilecek kişi sayısı',
    default: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  microphoneLimit = 5;

  @ApiPropertyOptional({
    description: 'Mobil mikrofon sahnesi gizlensin mi?',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  microphoneStageHidden = false;

  @ApiPropertyOptional({ description: 'Özel oda mı?', default: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  isPrivate = false;

  @ApiPropertyOptional({
    description: 'Özel oda şifresi (sadece özel odalarda kullanılır)',
  })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional({ description: 'Radyo panel linki' })
  @IsOptional()
  @IsString()
  radioPanelLink?: string;

  @ApiPropertyOptional({ description: 'Radyo istek paneli linki' })
  @IsOptional()
  @IsString()
  radioRequestLink?: string;

  @ApiProperty({ description: 'Listeleme sırası' })
  @IsInt()
  @Type(() => Number)
  listOrder: number;

  @ApiPropertyOptional({ description: 'Minimum yıldız', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  minStar = 0;

  @ApiPropertyOptional({ description: 'Arka plan rengi' })
  @IsOptional()
  @IsString()
  backgroundColor?: string;

  @ApiPropertyOptional({
    description: 'Oda resmi linki (dosya yerine link gönderilebilir)',
  })
  @IsOptional()
  @IsString()
  roomImage?: string;

  @ApiPropertyOptional({
    description: 'Logo linki (dosya yerine link gönderilebilir)',
  })
  @IsOptional()
  @IsString()
  logo?: string;
}
