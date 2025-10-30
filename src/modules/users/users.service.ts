import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../../shared/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  private async findUserByIdOrThrow(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user || user.deletedAt) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findAll() {
    return this.prisma.user.findMany({
      where: { deletedAt: null },
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

  async findOne(id: string) {
    await this.findUserByIdOrThrow(id);

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

  async getUserRoles(userId: string) {
    const user = await this.findOne(userId);

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

  async assignRoles(userId: string, roleIds: string[]) {
    await this.findUserByIdOrThrow(userId);

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

  async removeRole(userId: string, roleId: string) {
    await this.findUserByIdOrThrow(userId);

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

  async softDelete(id: string) {
    await this.findUserByIdOrThrow(id);

    return this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}

