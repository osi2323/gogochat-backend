import { ApiProperty } from '@nestjs/swagger';

export class CreatorInfoDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'CasH' })
  username: string;
}

export class ForbiddenWordResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'as' })
  forbiddenWord: string;

  @ApiProperty({ example: 'Aleykum Selam' })
  replacementWord: string;

  @ApiProperty({
    type: CreatorInfoDto,
    nullable: true,
    description: 'Kaydı oluşturan admin',
  })
  createdBy?: CreatorInfoDto | null;

  @ApiProperty({ example: '2024-06-01T12:00:00.000Z' })
  createdAt: Date;
}
