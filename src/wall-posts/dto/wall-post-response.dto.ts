import { ApiProperty } from '@nestjs/swagger';
import { Gender } from '../../common/enums/gender.enum';
import { WallPostVisibility } from '../enums/wall-post-visibility.enum';

class WallPostUserDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'john_doe' })
  username: string;

  @ApiProperty({ example: 'AjanX', nullable: true })
  agentNickname?: string | null;

  @ApiProperty({ enum: Gender, example: 'male' })
  gender: Gender;

  @ApiProperty({ example: 'crown', nullable: true })
  icon: string | null;

  @ApiProperty({ example: 1 })
  starCount: number;

  @ApiProperty({ example: '#FFD700', nullable: true })
  starColor: string | null;
}

export class WallPostResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Merhaba 👋', nullable: true })
  content: string | null;

  @ApiProperty({ nullable: true })
  image: string | null;

  @ApiProperty({ nullable: true, example: '#FFF4C2' })
  backgroundColor: string | null;

  @ApiProperty({ enum: WallPostVisibility })
  visibility: WallPostVisibility;

  @ApiProperty({ example: 0 })
  likeCount: number;

  @ApiProperty({ example: 0 })
  commentCount: number;

  @ApiProperty({ example: false })
  isLiked: boolean;

  @ApiProperty({ example: false })
  isViewed: boolean;

  @ApiProperty({ type: () => WallPostUserDto })
  user: WallPostUserDto;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  updatedAt: string;
}
