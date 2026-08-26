import { ApiProperty } from '@nestjs/swagger';

export class WebConsoleAnimationItemDto {
  @ApiProperty()
  fileName: string;

  @ApiProperty()
  url: string;

  @ApiProperty()
  extension: string;

  @ApiProperty()
  sizeBytes: number;

  @ApiProperty()
  updatedAt: string;

  @ApiProperty()
  width: number;

  @ApiProperty()
  height: number;
}

export class WebConsoleAnimationsResponseDto {
  @ApiProperty()
  totalCount: number;

  @ApiProperty()
  maxCount: number;

  @ApiProperty()
  remainingSlots: number;

  @ApiProperty({ nullable: true, required: false })
  requiredWidth: number | null;

  @ApiProperty({ nullable: true, required: false })
  requiredHeight: number | null;

  @ApiProperty({ type: [WebConsoleAnimationItemDto] })
  items: WebConsoleAnimationItemDto[];
}
