import { ApiProperty } from '@nestjs/swagger';
import { Gender } from '../../common/enums/gender.enum';

class WallPostCommentUserDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'john_doe' })
  username: string;

  @ApiProperty({ example: 'AjanX', nullable: true })
  displayUsername?: string | null;

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

export class WallPostCommentResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Harika!' })
  content: string;

  @ApiProperty({ type: () => WallPostCommentUserDto })
  user: WallPostCommentUserDto;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  createdAt: string;
}
