import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, ValidateIf } from 'class-validator';

export class UpdateUserGifDto {
  @ApiProperty({
    description:
      'Kullanıcının profilde göstereceği user gif yolu. null gönderilirse temizlenir.',
    example: '/usergifler/kelebek.gif',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  userGif?: string | null;
}
