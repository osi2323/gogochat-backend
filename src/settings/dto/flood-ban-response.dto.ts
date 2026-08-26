import { ApiProperty } from '@nestjs/swagger';

export class FloodBanListItemDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  ipAddress: string;

  @ApiProperty()
  reason: string;

  @ApiProperty()
  source: string;

  @ApiProperty({ nullable: true })
  expiresAt: string | null;

  @ApiProperty({ nullable: true })
  createdAt: string | null;

  @ApiProperty({ nullable: true, required: false })
  metadata?: Record<string, unknown> | null;
}

export class FloodBanListResponseDto {
  @ApiProperty({ type: [FloodBanListItemDto] })
  items: FloodBanListItemDto[];

  @ApiProperty()
  total: number;
}
