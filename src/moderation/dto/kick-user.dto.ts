import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class KickUserDto {
  @ApiProperty({ example: 'ahmet', description: 'Atılacak kullanıcı adı' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({
    example: 'Uzun süre hareketsiz',
    description: 'Atılma sebebi (opsiyonel)',
    required: false,
  })
  @IsString()
  reason?: string;
}
