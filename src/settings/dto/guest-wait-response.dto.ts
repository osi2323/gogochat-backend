import { ApiProperty } from '@nestjs/swagger';

export class GuestWaitResponseDto {
  @ApiProperty({ example: 30 })
  guestWaitSeconds: number;

  @ApiProperty({ example: '2026-05-08T18:30:00.000Z', nullable: true })
  guestWaitUpdatedAt?: string | null;
}
