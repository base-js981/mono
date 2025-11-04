import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { AuditService } from './audit.service';
import { AUDIT_META_KEY } from './audit.decorator';
import { AuditMetaOptions } from './types/audit.types';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService, private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request & any>();
    const res = http.getResponse<any>();

    const method = req.method;
    const path = req.originalUrl || req.url;
    const user = req.user || {};
    const tenant = req.tenant;
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.ip;
    const userAgent = req.headers['user-agent'] as string | undefined;
    const requestId = (req.headers['x-request-id'] as string) || undefined;

    const shouldAudit =
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) ||
      (method === 'GET' && path.includes('/download'));
    if (!shouldAudit) {
      return next.handle();
    }

    const meta = this.reflector.getAllAndOverride<AuditMetaOptions | undefined>(AUDIT_META_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const resolved = this.resolveActionAndResource(method, path, meta);
    const payload = this.buildPayload(req);

    return next.handle().pipe(
      tap(async (data) => {
        await this.auditService.record({
          actorId: user?.id,
          actorEmail: user?.email,
          action: resolved.action,
          resource: resolved.resource,
          resourceId: this.extractResourceId(path, data),
          tenantId: tenant?.id,
          status: 'success',
          method,
          path,
          ipAddress,
          userAgent,
          requestId,
          payload,
        });
      }),
      catchError(async (err) => {
        await this.auditService.record({
          actorId: user?.id,
          actorEmail: user?.email,
          action: resolved.action,
          resource: resolved.resource,
          resourceId: this.extractResourceId(path),
          tenantId: tenant?.id,
          status: 'fail',
          method,
          path,
          ipAddress,
          userAgent,
          requestId,
          payload,
          errorMessage: err?.message ?? 'Unknown error',
        });
        throw err;
      }) as any,
    );
  }

  private resolveActionAndResource(method: string, path: string, meta?: AuditMetaOptions) {
    const httpToAction: Record<string, string> = {
      POST: 'create',
      PUT: 'update',
      PATCH: 'update',
      DELETE: 'delete',
      GET: path.includes('/download') ? 'download' : 'read',
    };
    const action = meta?.action ?? httpToAction[method] ?? method.toLowerCase();
    const resource = meta?.resource ?? this.inferResourceFromPath(path);
    return { action, resource };
  }

  private inferResourceFromPath(path: string): string {
    const clean = path.split('?')[0];
    const segments = clean.split('/').filter(Boolean);
    return (segments[0] || 'unknown').replace(/s$/, '');
  }

  private extractResourceId(path: string, data?: any): string | undefined {
    const clean = path.split('?')[0];
    const segments = clean.split('/').filter(Boolean);
    const maybeId = segments[1];
    if (maybeId && maybeId.length >= 8) {
      return maybeId;
    }
    if (data && typeof data === 'object' && data.id && typeof data.id === 'string') {
      return data.id;
    }
    return undefined;
  }

  private buildPayload(req: any) {
    return {
      params: req.params,
      query: req.query,
      body: req.body,
    };
  }
}


