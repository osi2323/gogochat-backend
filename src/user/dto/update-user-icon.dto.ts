import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, ValidateIf } from 'class-validator';

export class UpdateUserIconDto {
  @ApiPropertyOptional({
    description:
      'Kullanıcının seçmek istediği profil ikonu bilgisi (null ile temizlenebilir)',
    example: 'star-icon',
    nullable: true,
  })
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString({ message: 'Icon değeri string olmalıdır' })
  @IsOptional()
  icon: string | null;
}
