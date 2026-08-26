import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserFontNameDto {
  @ApiProperty({
    description: 'Kullanıcının yazı tipi adı (font family name)',
    example: 'Arial',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  fontName?: string | null;
}
