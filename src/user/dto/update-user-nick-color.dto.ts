import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, Matches, ValidateIf } from 'class-validator';

export class UpdateUserNickColorDto {
  @ApiProperty({
    description:
      'Kullanıcının rumuz rengi (#RRGGBB). null gönderilirse temizlenir.',
    example: '#2563EB',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  nickColor?: string | null;
}
