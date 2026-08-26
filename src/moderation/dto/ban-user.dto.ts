import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class BanUserDto {
  @ApiProperty({
    description: 'Banlanacak kullanıcı adı',
    example: 'kullanici123',
  })
  @IsString({ message: 'Kullanıcı adı metin olmalı' })
  @MinLength(3, { message: 'Kullanıcı adı en az 3 karakter olmalı' })
  username: string;

  @ApiPropertyOptional({
    description: 'Ban nedeni',
    example: 'Kurallara aykırı davranış',
  })
  @IsOptional()
  @IsString({ message: 'Neden metin olmalı' })
  @MaxLength(500, { message: 'Neden en fazla 500 karakter olabilir' })
  reason?: string;

  @ApiPropertyOptional({
    description: 'Ban bitiş tarihi (ISO)',
    example: '2025-12-31T23:59:59.000Z',
    nullable: true,
  })
  @IsOptional()
  @IsDateString({}, { message: 'Geçerli bir tarih olmalı' })
  expiresAt?: string;
}
