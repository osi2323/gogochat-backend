import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class CreateWallPostCommentDto {
  @ApiProperty({ description: 'Yorum içeriği' })
  @IsString()
  @MaxLength(500)
  content: string;
}
