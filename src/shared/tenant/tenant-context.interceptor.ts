import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantResolverService, TenantContext } from './tenant-resolver.service';

declare module 'express' {
  interface Request {
    tenant?: TenantContext;
  }
}

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(private readonly tenantResolver: TenantResolverService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();

    try {
      const tenant = await this.tenantResolver.resolveTenantFromRequest(request);
      if (tenant) {
        request.tenant = tenant;
      }
    } catch (error) {
      // Tenant not found - continue without tenant context
      // Controllers/Guards can handle this if needed
    }

    return next.handle();
  }
}

