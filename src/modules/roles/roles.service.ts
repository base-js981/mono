import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../../shared/prisma.service';
import { CreateRoleDto, AssignPermissionDto } from './dtos/create-role.dto';
import { UpdateRoleDto } from './dtos/update-role.dto';

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  private async findRoleByIdOrThrow(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return role;
  }

  async create(createRoleDto: CreateRoleDto) {
    try {
      return await this.prisma.role.create({
        data: {
          name: createRoleDto.name,
          description: createRoleDto.description,
        },
      });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Role with this name already exists');
      }
      throw error;
    }
  }

  async findAll() {
    return this.prisma.role.findMany({
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: {
            userRoles: true,
          },
        },
      },
    });
  }

  async findOne(id: string) {
    await this.findRoleByIdOrThrow(id);

    return this.prisma.role.findUnique({
      where: { id },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });
  }

  async update(id: string, updateRoleDto: UpdateRoleDto) {
    await this.findRoleByIdOrThrow(id);

    return this.prisma.role.update({
      where: { id },
      data: {
        description: updateRoleDto.description,
      },
    });
  }

  async remove(id: string) {
    await this.findRoleByIdOrThrow(id);

    await this.prisma.role.delete({
      where: { id },
    });

    return { message: 'Role deleted successfully' };
  }

  async assignPermissions(id: string, assignPermissionDto: AssignPermissionDto) {
    await this.findRoleByIdOrThrow(id);

    await this.prisma.$transaction(async (tx) => {
      const permissions = await tx.permission.findMany({
        where: {
          name: { in: assignPermissionDto.permissions },
        },
      });

      if (permissions.length !== assignPermissionDto.permissions.length) {
        const foundNames = permissions.map((p) => p.name);
        const missingNames = assignPermissionDto.permissions.filter(
          (name) => !foundNames.includes(name),
        );
        throw new NotFoundException(
          `Permissions not found: ${missingNames.join(', ')}`,
        );
      }

      await tx.rolePermission.deleteMany({
        where: { roleId: id },
      });

      if (permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: permissions.map((perm) => ({
            roleId: id,
            permissionId: perm.id,
          })),
        });
      }
    });

    return this.findOne(id);
  }

  async getRolePermissions(id: string) {
    const role = await this.findOne(id);

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return role.rolePermissions.map((rp) => rp.permission);
  }
}

