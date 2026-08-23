import { ApiProperty } from '@nestjs/swagger';

export class FirstMessageDelayResponseDto {
  @ApiProperty({ example: false })
  firstMessageDelayEnabled: boolean;

  @ApiProperty({ example: 0 })
  firstMessageDelaySeconds: number;

  @ApiProperty({ example: '2026-05-08T18:30:00.000Z', nullable: true })
  firstMessageDelayUpdatedAt?: string | null;
}
