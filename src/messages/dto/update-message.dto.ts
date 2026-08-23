import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateMessageDto {
  @ApiPropertyOptional({ description: 'Mesaj içeriği' })
  @IsOptional()
  @IsString()
  content?: string;
}
