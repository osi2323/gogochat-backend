import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, ValidateIf } from 'class-validator';

export class UpdateUserFrameDto {
  @ApiPropertyOptional({
    description:
      'Kullanıcının seçmek istediği profil çerçevesi bilgisi (null göndererek temizlenebilir)',
    example: 'gold-frame',
    nullable: true,
  })
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString({ message: 'Frame değeri string olmalıdır' })
  @IsOptional()
  frame: string | null;
}
