import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma.service';
import { CreateTenantDto } from './dtos/create-tenant.dto';
import { UpdateTenantDto } from './dtos/update-tenant.dto';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createTenantDto: CreateTenantDto) {
    const existingTenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [
          { slug: createTenantDto.slug },
          ...(createTenantDto.domain ? [{ domain: createTenantDto.domain }] : []),
        ],
      },
    });

    if (existingTenant) {
      throw new ConflictException('Tenant with this slug or domain already exists');
    }

    return this.prisma.tenant.create({
      data: {
        slug: createTenantDto.slug,
        name: createTenantDto.name,
        domain: createTenantDto.domain,
        isActive: createTenantDto.isActive ?? true,
        settings: createTenantDto.settings || {},
      },
    });
  }

  async findAll() {
    return this.prisma.tenant.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  async findBySlug(slug: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        slug,
        deletedAt: null,
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  async update(id: string, updateTenantDto: UpdateTenantDto) {
    const tenant = await this.findOne(id);

    if (updateTenantDto.slug || updateTenantDto.domain) {
      const existingTenant = await this.prisma.tenant.findFirst({
        where: {
          OR: [
            ...(updateTenantDto.slug ? [{ slug: updateTenantDto.slug }] : []),
            ...(updateTenantDto.domain ? [{ domain: updateTenantDto.domain }] : []),
          ],
          NOT: {
            id,
          },
        },
      });

      if (existingTenant) {
        throw new ConflictException('Tenant with this slug or domain already exists');
      }
    }

    return this.prisma.tenant.update({
      where: { id },
      data: {
        ...(updateTenantDto.slug && { slug: updateTenantDto.slug }),
        ...(updateTenantDto.name && { name: updateTenantDto.name }),
        ...(updateTenantDto.domain !== undefined && { domain: updateTenantDto.domain }),
        ...(updateTenantDto.isActive !== undefined && { isActive: updateTenantDto.isActive }),
        ...(updateTenantDto.settings !== undefined && { settings: updateTenantDto.settings as any }),
      },
    });
  }

  async remove(id: string) {
    const tenant = await this.findOne(id);

    await this.prisma.tenant.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { message: 'Tenant deleted successfully' };
  }
}

