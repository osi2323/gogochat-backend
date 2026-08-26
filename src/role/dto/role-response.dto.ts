import { ApiProperty } from '@nestjs/swagger';

export class RoleResponseDto {
  @ApiProperty({
    description: 'Role ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'Role name',
    example: 'Moderator',
  })
  name: string;

  @ApiProperty({
    description: 'Microphone duration in seconds',
    example: 60,
  })
  microphoneDuration: number;

  @ApiProperty({
    description: 'Star color in hex format',
    example: '#FFD700',
  })
  starColor: string;

  @ApiProperty({
    description: 'Number of stars',
    example: 5,
  })
  starCount: number;

  @ApiProperty({
    description: 'Icon string identifier',
    example: 'crown',
    nullable: true,
  })
  icon: string | null;

  @ApiProperty({
    description: 'Permission flags as key-value pairs',
    example: { canKick: true, canBan: false, canMute: true },
  })
  permissions: Record<string, boolean>;
}
