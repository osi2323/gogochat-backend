import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateFriendRequestDto {
  @IsString()
  @IsNotEmpty()
  targetUsername: string;

  @IsString()
  @IsOptional()
  targetAgentNickname?: string;
}
