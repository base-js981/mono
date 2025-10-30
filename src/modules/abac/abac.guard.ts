import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { PolicyEngine } from './policy-engine';
import { PolicyContext } from './types/policy.types';

@Injectable()
export class AbacGuard implements CanActivate {
  constructor(private policyEngine: PolicyEngine) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    // Suy ra resource nếu chưa có: mặc định lấy id từ route params
    const resource = request.resource ?? { id: request.params?.id };

    if (!user) {
      return false;
    }

    const policyContext: PolicyContext = {
      subject: {
        id: user.id,
        role: user.roles?.[0], // Primary role
        roles: user.roles,
        permissions: user.permissions,
        department: user.department,
        tenantId: user.tenantId,
        clearanceLevel: user.clearanceLevel,
      },
      resource: resource,
      action: request.method,
      environment: {
        timeOfDay: new Date().toTimeString(),
        date: new Date().toDateString(),
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      },
    };

    const decision = await this.policyEngine.evaluate(policyContext);

    return decision.effect === 'allow';
  }
}

