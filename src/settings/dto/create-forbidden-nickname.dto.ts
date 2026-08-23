import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateForbiddenNicknameDto {
  @ApiProperty({
    description: 'Yasaklanacak nick',
    example: 'bad_nick',
  })
  @IsNotEmpty({ message: 'Nickname zorunlu' })
  @IsString({ message: 'Nickname string olmalı' })
  @MaxLength(100, { message: 'En fazla 100 karakter olmalı' })
  nickname: string;
}
