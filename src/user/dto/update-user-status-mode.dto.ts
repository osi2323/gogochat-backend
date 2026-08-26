import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class UpdateUserStatusModeDto {
  @ApiProperty({
    description: 'Seçilecek durum modu ID',
    example: 1,
  })
  @IsInt()
  @Min(1)
  statusModeId: number;
}
