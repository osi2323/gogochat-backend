import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class UpdateUsernameDto {
  @ApiProperty({ description: 'Yeni kullanıcı adı', example: 'yeni_nick' })
  @IsNotEmpty({ message: 'Kullanıcı adı zorunlu' })
  @IsString({ message: 'Kullanıcı adı metin olmalı' })
  @MinLength(3, { message: 'Kullanıcı adı en az 3 karakter olmalı' })
  username: string;
}
