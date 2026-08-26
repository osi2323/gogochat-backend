import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class CreateProfileCommentDto {
  @ApiProperty({ description: 'Profil yorumu içeriği' })
  @IsString()
  @MaxLength(500)
  content: string;
}
