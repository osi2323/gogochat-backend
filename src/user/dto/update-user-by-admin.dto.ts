import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Gender } from '../../common/enums/gender.enum';

export class UpdateUserByAdminDto {
  @ApiPropertyOptional({ description: 'Yeni rumuz', example: 'yeni_nick' })
  @IsOptional()
  @IsString({ message: 'Rumuz metin olmalı' })
  @MinLength(3, { message: 'Rumuz en az 3 karakter olmalı' })
  username?: string;

  @ApiPropertyOptional({ description: 'Yeni şifre', example: 'password123' })
  @IsOptional()
  @IsString({ message: 'Şifre metin olmalı' })
  @MinLength(6, { message: 'Şifre en az 6 karakter olmalı' })
  password?: string;

  @ApiPropertyOptional({ description: 'Cinsiyet', enum: Gender })
  @IsOptional()
  @IsEnum(Gender, { message: 'Cinsiyet male veya female olmalı' })
  gender?: Gender;

  @ApiPropertyOptional({ description: 'Rol ID', example: 2 })
  @IsOptional()
  @IsInt({ message: 'Rol ID sayı olmalı' })
  roleId?: number;

  @ApiPropertyOptional({
    description: 'Koruma durumu',
    example: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Koruma değeri boolean olmalı' })
  protection?: boolean;

  @ApiPropertyOptional({
    description: 'Üyelik bitiş tarihi (ISO format)',
    example: '2024-12-31T23:59:59.000Z',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString({}, { message: 'Üyelik bitiş tarihi geçerli bir tarih olmalı' })
  membershipExpiresAt?: string | null;

  @ApiPropertyOptional({
    description: 'Kullanıcıya özel izinler',
    example: ['Admin Paneli', 'Oda Yönetimi'],
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'İzinler liste olmalı' })
  @IsString({ each: true, message: 'İzinler metin olmalı' })
  permissions?: string[];

  @ApiPropertyOptional({
    description:
      'Kullanıcının flash nick görseli (data:image/png;base64,..., data:image/jpeg;base64,... veya data:image/gif;base64,...). null ile temizlenebilir',
    nullable: true,
  })
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString({ message: 'flashNick değeri string olmalıdır' })
  @IsOptional()
  flashNick?: string | null;

  @ApiPropertyOptional({
    description: 'Hesap dondurma/kilit durumu. false ile kilit kaldırılır.',
    example: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Hesap kilidi boolean olmalı' })
  accountFrozen?: boolean;
}
