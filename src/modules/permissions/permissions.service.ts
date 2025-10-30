import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma.service';
import { CreatePermissionDto } from './dtos/create-permission.dto';
import { UpdatePermissionDto } from './dtos/update-permission.dto';

@Injectable()
export class PermissionsService {
  constructor(private prisma: PrismaService) {}

  async create(createPermissionDto: CreatePermissionDto) {
    const existingPermission = await this.prisma.permission.findUnique({
      where: { name: createPermissionDto.name },
    });

    if (existingPermission) {
      throw new ConflictException('Permission with this name already exists');
    }

    return this.prisma.permission.create({
      data: {
        name: createPermissionDto.name,
        resource: createPermissionDto.resource,
        action: createPermissionDto.action,
        description: createPermissionDto.description,
      },
    });
  }

  async findAll() {
    return this.prisma.permission.findMany({
      include: {
        _count: {
          select: {
            rolePermissions: true,
          },
        },
      },
    });
  }

  async findOne(id: string) {
    const permission = await this.prisma.permission.findUnique({
      where: { id },
      include: {
        rolePermissions: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!permission) {
      throw new NotFoundException('Permission not found');
    }

    return permission;
  }

  async update(id: string, updatePermissionDto: UpdatePermissionDto) {
    const permission = await this.findOne(id);

    return this.prisma.permission.update({
      where: { id: permission.id },
      data: {
        description: updatePermissionDto.description,
      },
    });
  }

  async remove(id: string) {
    const permission = await this.findOne(id);

    await this.prisma.permission.delete({
      where: { id: permission.id },
    });

    return { message: 'Permission deleted successfully' };
  }
}

