import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class SendSystemMessageDto {
  @ApiProperty({ example: 'Sistem bakımı 10 dakika içinde başlayacaktır.' })
  @IsString()
  @MinLength(1)
  content: string;
}
