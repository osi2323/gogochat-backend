import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CheckRoomAccessDto {
  @ApiPropertyOptional({ description: 'Oda id' })
  @IsOptional()
  @IsString()
  roomId?: string;

  @ApiPropertyOptional({ description: 'Oda voice id veya aktif room key' })
  @IsOptional()
  @IsString()
  room?: string;

  @ApiPropertyOptional({ description: 'Oda görünen adı' })
  @IsOptional()
  @IsString()
  roomName?: string;
}
