import { ApiProperty } from '@nestjs/swagger';

class WallPostViewUserDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  username: string;

  @ApiProperty({ nullable: true })
  icon: string | null;
}

export class WallPostViewResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty({ type: () => WallPostViewUserDto })
  user: WallPostViewUserDto;

  @ApiProperty()
  createdAt: string;
}
