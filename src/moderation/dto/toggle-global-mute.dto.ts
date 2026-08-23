import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ToggleGlobalMuteDto {
  @ApiProperty({
    description: 'Tüm odalarda susturulacak kullanıcının kullanıcı adı',
    example: 'kullanici_adi',
  })
  @IsString()
  @IsNotEmpty()
  username: string;
}
