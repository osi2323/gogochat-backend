import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsHexColor,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { WallPostVisibility } from '../enums/wall-post-visibility.enum';

export class CreateWallPostDto {
  @ApiPropertyOptional({ description: 'Duvar yazısı içeriği' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  content?: string;

  @ApiPropertyOptional({ description: 'Resim base64 verisi' })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional({ description: 'Duvar yazısı arkaplan rengi (hex)' })
  @IsOptional()
  @IsHexColor()
  backgroundColor?: string;

  @ApiProperty({
    description: 'Görünürlük',
    enum: WallPostVisibility,
    default: WallPostVisibility.MEMBERS,
  })
  @IsEnum(WallPostVisibility)
  visibility: WallPostVisibility;
}
