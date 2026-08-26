import {
  IsNotEmpty,
  IsString,
  IsInt,
  IsObject,
  IsOptional,
  Min,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRoleDto {
  @ApiProperty({
    description: 'Role name',
    example: 'Moderator',
  })
  @IsNotEmpty({ message: 'Role name is required' })
  @IsString({ message: 'Role name must be a string' })
  name: string;

  @ApiProperty({
    description: 'Microphone duration in seconds',
    example: 60,
  })
  @IsNotEmpty({ message: 'Microphone duration is required' })
  @IsInt({ message: 'Microphone duration must be an integer' })
  @Min(0, { message: 'Microphone duration must be at least 0' })
  microphoneDuration: number;

  @ApiProperty({
    description: 'Star color in hex format',
    example: '#FFD700',
  })
  @IsNotEmpty({ message: 'Star color is required' })
  @IsString({ message: 'Star color must be a string' })
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'Star color must be a valid hex color (e.g., #FFD700)',
  })
  starColor: string;

  @ApiProperty({
    description: 'Number of stars',
    example: 5,
  })
  @IsNotEmpty({ message: 'Star count is required' })
  @IsInt({ message: 'Star count must be an integer' })
  @Min(0, { message: 'Star count must be at least 0' })
  starCount: number;

  @ApiProperty({
    description: 'Icon string identifier',
    example: 'crown',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Icon must be a string' })
  icon?: string;

  @ApiProperty({
    description: 'Permission flags as key-value pairs',
    example: { canKick: true, canBan: false, canMute: true },
  })
  @IsNotEmpty({ message: 'Permissions are required' })
  @IsObject({ message: 'Permissions must be an object' })
  permissions: Record<string, boolean>;
}
