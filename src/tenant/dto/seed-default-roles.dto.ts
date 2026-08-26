import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SeedDefaultRolesDto {
  @ApiProperty({
    description:
      'Hedef tenant şeması (tenant_ önekiyle birlikte veya sadece tenant adı)',
    example: 'tenant_master',
  })
  @IsString()
  @IsNotEmpty()
  schema: string;
}
