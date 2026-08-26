import { ApiProperty } from '@nestjs/swagger';

export class RadioSettingsResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ required: false, nullable: true })
  radioLink: string | null;

  @ApiProperty({ required: false, nullable: true })
  radioRequestLink: string | null;
}
