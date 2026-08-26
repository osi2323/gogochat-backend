import { ApiProperty } from '@nestjs/swagger';

export class ForbiddenNicknameResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'bad_nick' })
  nickname: string;

  @ApiProperty({
    example: 5,
    nullable: true,
    description: 'Kaydı oluşturan admin id',
  })
  createdById?: number | null;

  @ApiProperty({
    example: 'adminUser',
    nullable: true,
    description: 'Kaydı oluşturan admin kullanıcı adı',
  })
  createdByUsername?: string | null;

  @ApiProperty({ example: '2025-01-01T12:00:00.000Z' })
  createdAt: Date;
}
