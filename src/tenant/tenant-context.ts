import { Injectable, Scope } from '@nestjs/common';

@Injectable({ scope: Scope.REQUEST })
export class TenantContext {
  private tenant: string;

  setTenant(tenant: string) {
    this.tenant = tenant;
  }

  getTenant() {
    return this.tenant;
  }

  getSchema() {
    return this.tenant ? `tenant_${this.tenant}` : 'public';
  }
}
