import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { SearchScope } from './search-scope.enum';

export class CreateSearchHistoryDto {
  @ApiProperty({ description: 'Arama sorgusu' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  query: string;

  @ApiProperty({ description: 'Arama kapsamı' })
  @IsEnum(SearchScope)
  scope: SearchScope;

  @ApiPropertyOptional({ description: 'Sonuç sayısı' })
  @IsOptional()
  @IsInt()
  @Min(0)
  resultsCount?: number;
}
