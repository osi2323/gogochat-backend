import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateStatusModeDto {
  @ApiProperty({
    description: 'Durum modu adı',
    example: 'Çevrim içi',
  })
  @IsNotEmpty({ message: 'Durum modu adı zorunlu' })
  @IsString({ message: 'Durum modu adı metin olmalı' })
  @MaxLength(100, { message: 'Durum modu adı 100 karakteri geçemez' })
  name: string;
}
