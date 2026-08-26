import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class DeviceBanUserDto {
  @ApiProperty({
    description: 'Cihazı banlanacak kullanıcı adı',
    example: 'kullanici123',
  })
  @IsString({ message: 'Kullanıcı adı metin olmalı' })
  @MinLength(3, { message: 'Kullanıcı adı en az 3 karakter olmalı' })
  username: string;

  @ApiPropertyOptional({
    description: 'Hedef kullanıcının giriş geçmişi kaydı',
    example: 123,
  })
  @IsOptional()
  @IsInt({ message: 'Giriş kaydı numarası geçerli olmalı' })
  @Min(1, { message: 'Giriş kaydı numarası geçerli olmalı' })
  loginHistoryId?: number;
}
