import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Gender } from '../../common/enums/gender.enum';

class RoomOwnerDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  username: string;

  @ApiProperty({ enum: Gender })
  gender: Gender;

  @ApiPropertyOptional()
  icon?: string | null;

  @ApiPropertyOptional({
    description: 'Oda sahibinin rol bilgisi',
    example: {
      id: 1,
      name: 'admin',
      microphoneDuration: 60,
      starColor: '#FFD700',
      starCount: 5,
      icon: 'crown',
      permissions: { ban: true },
    },
  })
  role?: {
    id: number;
    name: string;
    microphoneDuration: number;
    starColor: string;
    starCount: number;
    icon: string | null;
    permissions: Record<string, boolean>;
  } | null;
}

export class RoomResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  voiceId?: string | null;

  @ApiPropertyOptional()
  ownerId?: number | null;

  @ApiPropertyOptional({ type: RoomOwnerDto })
  owner?: RoomOwnerDto | null;

  @ApiPropertyOptional()
  description?: string | null;

  @ApiProperty()
  maxUsers: number;

  @ApiProperty()
  visibleUserCount: number;

  @ApiProperty()
  isPrivate: boolean;

  @ApiProperty()
  isEditable: boolean;

  @ApiPropertyOptional()
  radioPanelLink?: string | null;

  @ApiPropertyOptional()
  radioRequestLink?: string | null;

  @ApiProperty()
  listOrder: number;

  @ApiProperty()
  minStar: number;

  @ApiPropertyOptional()
  backgroundColor?: string | null;

  @ApiPropertyOptional()
  roomImage?: string | null;

  @ApiPropertyOptional()
  logo?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
