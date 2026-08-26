import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, ValidateIf } from 'class-validator';

export class UpdateUserFlashNickDto {
  @ApiPropertyOptional({
    description:
      'Kullanıcının flash nick görseli (data:image/png;base64,..., data:image/jpeg;base64,... veya data:image/gif;base64,...). null ile temizlenebilir',
    nullable: true,
  })
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString({ message: 'flashNick değeri string olmalıdır' })
  @IsOptional()
  flashNick: string | null;
}
