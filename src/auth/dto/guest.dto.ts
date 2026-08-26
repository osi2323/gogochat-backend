import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Gender } from '../../common/enums/gender.enum';

export class GuestDto {
  @ApiProperty({
    description: 'The username of the guest',
    example: 'guest_user',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(15)
  username: string;

  @ApiProperty({
    description: 'The gender of the guest',
    example: Gender.MALE,
    enum: Gender,
  })
  @IsEnum(Gender)
  gender: Gender;
}
