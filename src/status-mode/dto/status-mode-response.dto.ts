import { ApiProperty } from '@nestjs/swagger';

export class StatusModeResponseDto {
  @ApiProperty({
    description: 'Durum modu ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'Durum modu adı',
    example: 'Çevrim içi',
  })
  name: string;
}
