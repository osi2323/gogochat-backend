import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type {
  CallHistoryDirection,
  CallHistoryStatus,
} from '../entities/call-history.entity';

export class CreateCallHistoryDto {
  @ApiProperty({ description: 'Socket çağrı kimliği' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  callId: string;

  @ApiProperty({ description: 'Karşı taraf görünen adı' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  peerName: string;

  @ApiProperty({ enum: ['incoming', 'outgoing'] })
  @IsIn(['incoming', 'outgoing'])
  direction: CallHistoryDirection;

  @ApiProperty({ enum: ['missed', 'completed', 'rejected', 'canceled'] })
  @IsIn(['missed', 'completed', 'rejected', 'canceled'])
  status: CallHistoryStatus;

  @ApiProperty({ description: 'Çağrı başlangıç zamanı' })
  @IsDateString()
  startedAt: string;

  @ApiPropertyOptional({ description: 'Çağrı bitiş zamanı' })
  @IsOptional()
  @IsDateString()
  endedAt?: string;

  @ApiPropertyOptional({ description: 'Süre, saniye' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(24 * 60 * 60)
  durationSec?: number;
}
