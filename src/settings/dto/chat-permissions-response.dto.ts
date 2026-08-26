import { ApiProperty } from '@nestjs/swagger';
import { AccessLevel } from '../entities/system-settings.entity';

export class ChatPermissionsResponseDto {
  @ApiProperty({ enum: AccessLevel, example: AccessLevel.EVERYONE })
  chatImageSendPermission: AccessLevel;

  @ApiProperty({ enum: AccessLevel, example: AccessLevel.MEMBERS })
  chatVoiceSendPermission: AccessLevel;

  @ApiProperty({ enum: AccessLevel, example: AccessLevel.NONE })
  chatVoiceRecordSendPermission: AccessLevel;

  @ApiProperty({ enum: AccessLevel, example: AccessLevel.EVERYONE })
  chatYoutubeSendPermission: AccessLevel;
}
