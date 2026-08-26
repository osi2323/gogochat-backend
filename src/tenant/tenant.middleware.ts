import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TenantContext } from './tenant-context';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private readonly configService: ConfigService,
    private readonly tenantContext: TenantContext,
  ) {}

  use(req: any, res: any, next: () => void) {
    // 1 - Setup mode enabled → master tenant
    const setupMode = this.configService.get('SETUP_MODE');
    if (setupMode === 'true' || setupMode === true) {
      req.tenant = 'master';
      this.tenantContext.setTenant('master');
      return next();
    }

    let tenant = req.headers['x-tenant'];

    if (!tenant && req.hostname) {
      const parts = req.hostname.split('.');
      tenant = parts[0];
    }

    if (!tenant) {
      throw new Error('Tenant not provided');
    }

    req.tenant = tenant.toLowerCase();
    this.tenantContext.setTenant(req.tenant);
    next();
  }
}
