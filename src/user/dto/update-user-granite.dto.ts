import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserGraniteDto {
  @ApiProperty({
    description: 'Kullanıcının granit bilgisi (örn: mermer, granit, vb.)',
    example: 'marble',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  granite?: string | null;
}
