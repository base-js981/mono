import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import type { Request } from 'express';

export interface TenantContext {
  id: string;
  slug: string;
  name: string;
  domain?: string;
  isActive: boolean;
}

@Injectable()
export class TenantResolverService {
  private readonly resolutionMode: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.resolutionMode = this.configService.get<string>('TENANT_RESOLUTION_MODE', 'jwt');
  }

  async resolveTenantFromRequest(request: Request & { user?: any }): Promise<TenantContext | null> {
    switch (this.resolutionMode) {
      case 'subdomain':
        return this.resolveFromSubdomain(request);
      case 'header':
        return this.resolveFromHeader(request);
      case 'jwt':
        return this.resolveFromJwt(request);
      case 'path':
        return this.resolveFromPath(request);
      default:
        return this.resolveFromJwt(request);
    }
  }

  private async resolveFromSubdomain(request: Request): Promise<TenantContext | null> {
    const host = request.headers.host || '';
    const subdomain = host.split('.')[0];

    if (!subdomain || subdomain === 'www' || subdomain === 'api') {
      return null;
    }

    return this.findTenantBySlug(subdomain);
  }

  private async resolveFromHeader(request: Request): Promise<TenantContext | null> {
    const tenantSlug = request.headers['x-tenant-id'] as string;
    const tenantId = request.headers['x-tenant-slug'] as string;

    if (!tenantSlug && !tenantId) {
      return null;
    }

    if (tenantSlug) {
      return this.findTenantBySlug(tenantSlug);
    }

    return this.findTenantById(tenantId);
  }

  private async resolveFromJwt(request: Request & { user?: any }): Promise<TenantContext | null> {
    const user = request.user;
    if (!user || !user.tenantId) {
      return null;
    }

    return this.findTenantById(user.tenantId);
  }

  private async resolveFromPath(request: Request): Promise<TenantContext | null> {
    const pathMatch = request.path.match(/^\/api\/tenant\/([^/]+)/);
    if (!pathMatch) {
      return null;
    }

    const tenantIdentifier = pathMatch[1];
    return this.findTenantBySlug(tenantIdentifier);
  }

  async findTenantById(id: string): Promise<TenantContext> {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        id,
        deletedAt: null,
        isActive: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found or inactive');
    }

    return {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      domain: tenant.domain || undefined,
      isActive: tenant.isActive,
    };
  }

  async findTenantBySlug(slug: string): Promise<TenantContext> {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        slug,
        deletedAt: null,
        isActive: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found or inactive');
    }

    return {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      domain: tenant.domain || undefined,
      isActive: tenant.isActive,
    };
  }

  async findTenantByDomain(domain: string): Promise<TenantContext> {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        domain,
        deletedAt: null,
        isActive: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found or inactive');
    }

    return {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      domain: tenant.domain || undefined,
      isActive: tenant.isActive,
    };
  }

  validateTenantAccess(userTenantId: string | null | undefined, requestedTenantId: string): void {
    if (!userTenantId) {
      throw new BadRequestException('User does not belong to any tenant');
    }

    if (userTenantId !== requestedTenantId) {
      throw new BadRequestException('Access denied: Tenant mismatch');
    }
  }
}

