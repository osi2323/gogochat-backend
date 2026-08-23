import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreateDirectMessageDto {
  @ApiPropertyOptional({ example: 'Merhaba!' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: 'Base64 encoded image' })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional({ description: 'Base64 encoded audio' })
  @IsOptional()
  @IsString()
  audio?: string;

  @ApiPropertyOptional({ example: 'voice-message.webm' })
  @IsOptional()
  @IsString()
  audioFileName?: string;

  @ApiPropertyOptional({ example: 123 })
  @IsOptional()
  @IsInt()
  replyToMessageId?: number;
}
