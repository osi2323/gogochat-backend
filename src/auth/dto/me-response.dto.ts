import { ApiProperty } from '@nestjs/swagger';
import { Gender } from '../../common/enums/gender.enum';
import { RoleResponseDto } from '../../role/dto/role-response.dto';
import { StatusModeResponseDto } from '../../status-mode/dto/status-mode-response.dto';
import type { ChatPreferences } from '../../user/chat-preferences.constants';

export class MeResponseDto {
  @ApiProperty({
    description: 'User ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'Username',
    example: 'john_doe',
  })
  username: string;

  @ApiProperty({
    description: 'Misafir kullanıcı mı',
    example: false,
  })
  isGuest: boolean;

  @ApiProperty({
    description: 'User gender',
    example: 'male',
  })
  gender: Gender;

  @ApiProperty({
    description: 'User profile frame information',
    example: 'gold-frame',
    required: false,
    nullable: true,
  })
  frame?: string | null;

  @ApiProperty({
    description: 'User profile icon information',
    example: 'crown',
    required: false,
    nullable: true,
  })
  icon?: string | null;

  @ApiProperty({
    description: 'User font name',
    example: 'Arial',
    required: false,
    nullable: true,
  })
  fontName?: string | null;

  @ApiProperty({
    description: 'User granite information',
    example: 'marble',
    required: false,
    nullable: true,
  })
  granite?: string | null;

  @ApiProperty({
    description: 'User nickname color (#RRGGBB)',
    example: '#2563EB',
    required: false,
    nullable: true,
  })
  nickColor?: string | null;

  @ApiProperty({
    description: 'User profile gif path',
    example: '/usergifler/kelebek.gif',
    required: false,
    nullable: true,
  })
  userGif?: string | null;

  @ApiProperty({
    description: 'User flash nick image (data URL)',
    required: false,
    nullable: true,
  })
  flashNick?: string | null;

  @ApiProperty({
    description: 'Hesap dondurma/kilit durumu',
    example: false,
    required: false,
  })
  accountFrozen?: boolean;

  @ApiProperty({
    description: 'User join effect information',
    example: 'ocean-ribbon',
    required: false,
    nullable: true,
  })
  joinEffect?: string | null;

  @ApiProperty({
    description: 'User role',
    type: () => RoleResponseDto,
    nullable: true,
  })
  role: RoleResponseDto | null;

  @ApiProperty({
    description: 'Kullanıcıya özel izinler',
    example: ['Özel Mesaj Atma', 'Toplantı Yetkisi'],
    type: [String],
  })
  permissions: string[];

  @ApiProperty({
    description: 'Kullanıcı durum modu',
    type: () => StatusModeResponseDto,
    nullable: true,
  })
  statusMode: StatusModeResponseDto | null;

  @ApiProperty({
    description: 'Account creation date',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Microphone ban status',
    example: false,
    required: false,
  })
  micBanned?: boolean;

  @ApiProperty({
    description: 'Camera ban status',
    example: false,
    required: false,
  })
  cameraBanned?: boolean;

  @ApiProperty({
    description: 'Global mute status across all rooms',
    example: false,
    required: false,
  })
  globalMuted?: boolean;

  @ApiProperty({
    description: 'Kullanıcı sohbet tercihleri',
    required: false,
  })
  chatPreferences?: ChatPreferences;
}
