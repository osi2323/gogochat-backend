import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBooleanString, IsOptional, IsString } from 'class-validator';

export class MessageQueryDto {
  @ApiPropertyOptional({
    description: 'Oda adı (filtrelemek için)',
    example: 'lobby',
  })
  @IsOptional()
  @IsString()
  roomName?: string;

  @ApiPropertyOptional({
    description: 'Temizlenmiş geçmiş filtresini yok say',
    example: 'true',
  })
  @IsOptional()
  @IsBooleanString()
  includeCleared?: string;
}
