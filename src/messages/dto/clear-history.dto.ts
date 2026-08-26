import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ClearHistoryDto {
  @ApiProperty({
    description: 'Temizlenecek oda adı',
    example: 'lobby',
  })
  @IsString()
  @IsNotEmpty()
  roomName: string;
}
