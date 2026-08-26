import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeOrmConfigService } from './typeorm-config.service';
import { TenantModule } from '../tenant/tenant.module';

@Module({
  imports: [
    TenantModule,
    TypeOrmModule.forRootAsync({
      imports: [TenantModule],
      useClass: TypeOrmConfigService,
    }),
  ],
})
export class DatabaseModule {}
