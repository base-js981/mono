import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import type { TenantContext } from './tenant-resolver.service';

@Injectable()
export abstract class TenantAwareService {
  constructor(protected readonly prisma: PrismaService) {}

  protected getTenantId(tenant?: TenantContext): string | null {
    return tenant?.id || null;
  }

  protected buildTenantWhere(tenant?: TenantContext) {
    const tenantId = this.getTenantId(tenant);
    return tenantId ? { tenantId } : {};
  }

  protected ensureTenantContext(tenant?: TenantContext, required: boolean = true): string {
    const tenantId = this.getTenantId(tenant);
    if (required && !tenantId) {
      throw new Error('Tenant context is required for this operation');
    }
    return tenantId || '';
  }

  protected validateTenantAccess(userTenantId: string | null | undefined, resourceTenantId: string | null | undefined): void {
    if (!userTenantId) {
      throw new Error('User does not belong to any tenant');
    }

    if (!resourceTenantId) {
      return; // Allow access to tenant-agnostic resources
    }

    if (userTenantId !== resourceTenantId) {
      throw new Error('Access denied: Tenant mismatch');
    }
  }
}

