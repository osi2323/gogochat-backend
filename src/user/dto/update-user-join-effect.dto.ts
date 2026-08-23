import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

const allowedJoinEffects = [
  'ocean-ribbon',
  'ruby-crown',
  'silver-comet',
  'aurora-prism',
  'royal-onyx',
  'gif-effect-1',
  'gif-effect-2',
  'gif-effect-3',
  'gif-effect-4',
  'gif-effect-dplpd',
] as const;

export class UpdateUserJoinEffectDto {
  @ApiPropertyOptional({
    nullable: true,
    enum: allowedJoinEffects,
  })
  @IsOptional()
  @IsIn(allowedJoinEffects)
  joinEffect?: (typeof allowedJoinEffects)[number] | null;
}
