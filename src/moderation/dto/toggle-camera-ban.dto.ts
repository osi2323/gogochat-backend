import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ToggleCameraBanDto {
  @ApiProperty({
    description: 'Kamera yasağı değiştirilecek kullanıcının kullanıcı adı',
    example: 'kullanici_adi',
  })
  @IsString()
  @IsNotEmpty()
  username: string;
}
