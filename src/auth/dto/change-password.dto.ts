import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Mevcut şifre',
    example: 'oldPassword123',
  })
  @IsNotEmpty({ message: 'Mevcut şifre zorunlu' })
  @IsString({ message: 'Mevcut şifre metin olmalı' })
  currentPassword: string;

  @ApiProperty({
    description: 'Yeni şifre',
    example: 'newPassword123',
  })
  @IsNotEmpty({ message: 'Yeni şifre zorunlu' })
  @IsString({ message: 'Yeni şifre metin olmalı' })
  @MinLength(6, { message: 'Yeni şifre en az 6 karakter olmalı' })
  newPassword: string;
}
