import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumberString, IsOptional } from 'class-validator';

export class DirectMessageQueryDto {
  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsNumberString()
  limit?: string;

  @ApiPropertyOptional({ example: 123 })
  @IsOptional()
  @IsNumberString()
  beforeId?: string;
}
