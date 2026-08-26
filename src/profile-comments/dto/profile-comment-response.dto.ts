import { ApiProperty } from '@nestjs/swagger';
import { Gender } from '../../common/enums/gender.enum';
import { ProfileCommentStatus } from '../entities/profile-comment.entity';

class ProfileCommentUserDto {
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

export class ProfileCommentResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Harika bir profil!' })
  content: string;

  @ApiProperty({ type: () => ProfileCommentUserDto })
  user: ProfileCommentUserDto;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ enum: ProfileCommentStatus, example: 'approved' })
  status: ProfileCommentStatus;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z', nullable: true })
  approvedAt: Date | null;
}
