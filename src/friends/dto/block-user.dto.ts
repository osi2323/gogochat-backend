import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class BlockUserDto {
  @IsString()
  @IsNotEmpty()
  targetUsername: string;

  @IsString()
  @IsOptional()
  targetAgentNickname?: string;
}
