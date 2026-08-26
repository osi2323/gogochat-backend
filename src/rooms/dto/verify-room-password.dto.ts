import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyRoomPasswordDto {
  @ApiProperty({ description: 'Oda adı' })
  @IsNotEmpty()
  @IsString()
  roomName: string;

  @ApiProperty({ description: 'Oda şifresi' })
  @IsNotEmpty()
  @IsString()
  password: string;
}
