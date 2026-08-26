import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateConversationDto {
  @ApiProperty({ example: 'kullanici1' })
  @IsString()
  @IsNotEmpty()
  targetUsername: string;

  @ApiProperty({ example: 'TestAgent', required: false })
  @IsString()
  @IsOptional()
  targetAgentNickname?: string;
}
