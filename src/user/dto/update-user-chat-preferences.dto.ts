import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateUserChatPreferencesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  rejectDirectMessages?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  rejectIncomingCalls?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  blockDmWhenTargetOffline?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  rejectRoomInvites?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  blockProfileComments?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  rejectFriendRequests?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  muteVibrationSounds?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hideDirectMessageAlerts?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showJoinLeaveEvents?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  disableJoinEffects?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hideGeneralMessages?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showTypingIndicators?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  muteCallRingtone?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  keepRoomChatHistory?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  keepDirectChatHistory?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ignoredUsernames?: string[];
}
