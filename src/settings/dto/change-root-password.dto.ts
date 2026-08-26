import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ChangeRootPasswordDto {
  @ApiProperty({ example: 'YeniGucluSifre123' })
  @IsString()
  @MinLength(1)
  password: string;
}
