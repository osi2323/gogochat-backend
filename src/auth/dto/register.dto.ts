import { IsEnum, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { Gender } from '../../common/enums/gender.enum';
import { ApiProperty } from '@nestjs/swagger/dist/decorators/api-property.decorator';

export class RegisterDto {
  @ApiProperty({
    description: 'The username of the user',
    example: 'john_doe',
  })
  @IsNotEmpty({ message: 'Username is required' })
  @IsString({ message: 'Username must be a string' })
  @MinLength(3, { message: 'Username must be at least 3 characters' })
  username: string;

  @ApiProperty({
    description: 'The password of the user',
    example: 'password123',
  })
  @IsNotEmpty({ message: 'Password is required' })
  @IsString({ message: 'Password must be a string' })
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password: string;

  @ApiProperty({
    description: 'The gender of the user',
    example: 'male',
  })
  @IsNotEmpty({ message: 'Gender is required' })
  @IsEnum(Gender, { message: 'Gender must be either male or female' })
  gender: Gender;
}
