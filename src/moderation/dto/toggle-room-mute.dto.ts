import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ToggleRoomMuteDto {
  @ApiProperty({
    description: 'Susturulacak kullanıcının kullanıcı adı',
    example: 'kullanici_adi',
  })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({
    description: 'Susturma işleminin uygulanacağı oda anahtarı (voiceId)',
    example: 'voice_genel',
  })
  @IsString()
  @IsNotEmpty()
  room: string;
}
