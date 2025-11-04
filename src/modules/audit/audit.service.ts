import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma.service';
import { AuditRecordInput } from './types/audit.types';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditRecordInput): Promise<void> {
    const sanitizedPayload = this.sanitizePayload(input.payload);
    await this.prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        actorEmail: input.actorEmail ?? null,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId ?? null,
        tenantId: input.tenantId ?? null,
        status: input.status,
        method: input.method ?? null,
        path: input.path ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        requestId: input.requestId ?? null,
        payload: sanitizedPayload as any,
        errorMessage: input.errorMessage ?? null,
      },
    });
  }

  private sanitizePayload(payload: unknown): unknown {
    if (!payload || typeof payload !== 'object') {
      return payload ?? null;
    }
    const forbiddenKeys = new Set([
      'password',
      'refreshToken',
      'accessToken',
      'secret',
      'ssn',
    ]);
    return this.deepOmit(payload as Record<string, unknown>, forbiddenKeys);
  }

  private deepOmit(value: unknown, forbiddenKeys: Set<string>): unknown {
    if (Array.isArray(value)) {
      return value.map(v => this.deepOmit(v, forbiddenKeys));
    }
    if (value && typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (forbiddenKeys.has(k)) {
          continue;
        }
        result[k] = this.deepOmit(v, forbiddenKeys);
      }
      return result;
    }
    return value;
  }
}


