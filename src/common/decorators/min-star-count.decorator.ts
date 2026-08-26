import { SetMetadata } from '@nestjs/common';

export const MIN_STAR_COUNT_KEY = 'minStarCount';
export const MinStarCount = (count: number) =>
  SetMetadata(MIN_STAR_COUNT_KEY, count);
