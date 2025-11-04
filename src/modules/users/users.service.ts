import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../../shared/prisma.service';
import { TenantAwareService } from '../../shared/tenant/tenant-aware.service';
import type { TenantContext } from '../../shared/tenant/tenant-resolver.service';
import { CreateUserDto } from './dtos/create-user.dto';
import { UpdateUserDto } from './dtos/update-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService extends TenantAwareService {
  constructor(protected readonly prisma: PrismaService) { super(prisma); }

  private async findUserByIdOrThrow(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user || user.deletedAt) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findAll(tenant?: TenantContext) {
    const tenantWhere = this.buildTenantWhere(tenant);
    return this.prisma.user.findMany({
      where: { deletedAt: null, ...tenantWhere },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  async findOne(id: string, tenant?: TenantContext) {
    const tenantWhere = this.buildTenantWhere(tenant);
    const found = await this.prisma.user.findFirst({ where: { id, deletedAt: null, ...tenantWhere } });
    if (!found) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.findUnique({
      where: { id },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  async create(dto: CreateUserDto, tenant?: TenantContext) {
    const tenantId = this.getTenantId(tenant);
    if (!tenantId) {
      throw new BadRequestException('Tenant context is required');
    }

    const existing = await this.prisma.user.findFirst({ where: { email: dto.email, tenantId } });
    if (existing) {
      throw new ConflictException('User with this email already exists in tenant');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        password: hashedPassword,
        emailVerified: dto.emailVerified ?? false,
        tenantId,
      },
    });

    return this.findOne(user.id, tenant);
  }

  async update(id: string, dto: UpdateUserDto, tenant?: TenantContext) {
    const current = await this.findOne(id, tenant);

    if (dto.email && current && dto.email !== current.email) {
      const dup = await this.prisma.user.findFirst({ where: { email: dto.email, tenantId: (current as any).tenantId || null } });
      if (dup) {
        throw new ConflictException('Email already in use in this tenant');
      }
    }

    let passwordUpdate: string | undefined;
    if (dto.password) {
      passwordUpdate = await bcrypt.hash(dto.password, 12);
    }

    await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.emailVerified !== undefined && { emailVerified: dto.emailVerified }),
        ...(passwordUpdate && { password: passwordUpdate }),
      },
    });

    return this.findOne(id, tenant);
  }

  async getUserRoles(userId: string, tenant?: TenantContext) {
    const user = await this.findOne(userId, tenant);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      roles: user.userRoles.map(ur => ({
        id: ur.role.id,
        name: ur.role.name,
        description: ur.role.description,
        permissions: ur.role.rolePermissions.map(rp => rp.permission.name),
      })),
    };
  }

  async assignRoles(userId: string, roleIds: string[], tenant?: TenantContext) {
    await this.findOne(userId, tenant);

    await this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({
        where: { userId },
      });

      if (roleIds.length > 0) {
        await tx.userRole.createMany({
          data: roleIds.map((roleId) => ({
            userId,
            roleId,
          })),
        });
      }
    });

    return this.getUserRoles(userId);
  }

  async removeRole(userId: string, roleId: string, tenant?: TenantContext) {
    await this.findOne(userId, tenant);

    const result = await this.prisma.userRole.deleteMany({
      where: {
        userId,
        roleId,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('Role assignment not found');
    }

    return { message: 'Role removed successfully' };
  }

  async softDelete(id: string, tenant?: TenantContext) {
    await this.findOne(id, tenant);

    return this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}

