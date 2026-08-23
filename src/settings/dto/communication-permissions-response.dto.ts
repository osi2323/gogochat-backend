import { ApiProperty } from '@nestjs/swagger';

export class CommunicationPermissionsResponseDto {
  @ApiProperty({ example: true })
  guestCanWrite: boolean;

  @ApiProperty({ example: 3 })
  memberAndGuestMicDurationSeconds: number;

  @ApiProperty({ example: true })
  membersPrivateMessageEnabled: boolean;

  @ApiProperty({ example: true })
  membersVoiceCallEnabled: boolean;

  @ApiProperty({ example: true })
  guestPrivateMessageEnabled: boolean;

  @ApiProperty({ example: true })
  guestVoiceCallEnabled: boolean;

  @ApiProperty({ example: true })
  showMicrophonesOnMobile: boolean;
}
