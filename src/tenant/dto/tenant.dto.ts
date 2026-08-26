import { IsString, IsNotEmpty, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TenantDto {
  @ApiProperty({
    description: 'The unique identifier for the tenant (subdomain)',
    example: 'company1',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, {
    message:
      'Tenant name can only contain lowercase letters, numbers, and hyphens',
  })
  tenant: string;
}
