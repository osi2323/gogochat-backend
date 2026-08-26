import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { TenantMiddleware } from './tenant.middleware';
import { TenantContext } from './tenant-context';

import { TenantAdminController } from './tenant-admin.controller';
import { TenantAdminService } from './tenant-admin.service';

@Module({
  controllers: [TenantAdminController],
  providers: [TenantContext, TenantAdminService],
  exports: [TenantContext],
})
export class TenantModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .exclude(
        { path: 'admin/tenants', method: RequestMethod.ALL },
        { path: 'admin/tenants/*path', method: RequestMethod.ALL },
      )
      .forRoutes('*path');
  }
}
