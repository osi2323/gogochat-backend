import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateForbiddenWordDto {
  @ApiProperty({
    description: 'Yasaklanacak kelime',
    example: 'as',
  })
  @IsNotEmpty({ message: 'Forbidden word is required' })
  @IsString({ message: 'Forbidden word must be a string' })
  @MaxLength(100, { message: 'Forbidden word must be at most 100 characters' })
  forbiddenWord: string;

  @ApiProperty({
    description: 'Yerine yazılacak kelime',
    example: 'Aleykum Selam',
  })
  @IsNotEmpty({ message: 'Replacement word is required' })
  @IsString({ message: 'Replacement word must be a string' })
  @MaxLength(255, {
    message: 'Replacement word must be at most 255 characters',
  })
  replacementWord: string;
}
