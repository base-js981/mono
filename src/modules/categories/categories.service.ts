import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma.service';
import { TenantAwareService } from '../../shared/tenant/tenant-aware.service';
import type { TenantContext } from '../../shared/tenant/tenant-resolver.service';
import { CreateCategoryDto } from './dtos/create-category.dto';
import { UpdateCategoryDto } from './dtos/update-category.dto';

@Injectable()
export class CategoriesService extends TenantAwareService {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async create(createCategoryDto: CreateCategoryDto, tenant?: TenantContext) {
    const tenantId = this.getTenantId(tenant);
    const slug = createCategoryDto.slug || this.generateSlug(createCategoryDto.name);

    const existingCategory = await this.prisma.category.findFirst({
      where: {
        slug,
        tenantId,
      },
    });

    if (existingCategory) {
      throw new ConflictException('Category with this slug already exists');
    }

    if (createCategoryDto.parentId) {
      const parent = await this.prisma.category.findFirst({
        where: {
          id: createCategoryDto.parentId,
          tenantId,
        },
      });

      if (!parent) {
        throw new NotFoundException('Parent category not found');
      }
    }

    return this.prisma.category.create({
      data: {
        name: createCategoryDto.name,
        slug,
        description: createCategoryDto.description,
        parentId: createCategoryDto.parentId,
        tenantId,
        isActive: createCategoryDto.isActive ?? true,
        sortOrder: createCategoryDto.sortOrder ?? 0,
      },
      include: {
        parent: true,
        children: true,
        _count: {
          select: {
            children: true,
          },
        },
      },
    });
  }

  async findAll(includeDeleted: boolean = false, tenant?: TenantContext) {
    const tenantWhere = this.buildTenantWhere(tenant);
    return this.prisma.category.findMany({
      where: {
        ...(includeDeleted ? {} : { deletedAt: null }),
        ...tenantWhere,
      },
      include: {
        parent: true,
        _count: {
          select: {
            children: true,
          },
        },
      },
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
    });
  }

  async findOne(id: string, tenant?: TenantContext) {
    const tenantWhere = this.buildTenantWhere(tenant);
    const category = await this.prisma.category.findFirst({
      where: {
        id,
        deletedAt: null,
        ...tenantWhere,
      },
      include: {
        parent: true,
        children: {
          where: {
            deletedAt: null,
          },
          orderBy: [
            { sortOrder: 'asc' },
            { name: 'asc' },
          ],
        },
        _count: {
          select: {
            children: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async findBySlug(slug: string, tenant?: TenantContext) {
    const tenantWhere = this.buildTenantWhere(tenant);
    const category = await this.prisma.category.findFirst({
      where: {
        slug,
        deletedAt: null,
        ...tenantWhere,
      },
      include: {
        parent: true,
        children: {
          where: {
            deletedAt: null,
          },
          orderBy: [
            { sortOrder: 'asc' },
            { name: 'asc' },
          ],
        },
        _count: {
          select: {
            children: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto, tenant?: TenantContext) {
    const category = await this.findOne(id, tenant);
    const tenantId = this.getTenantId(tenant);

    if (updateCategoryDto.slug && updateCategoryDto.slug !== category.slug) {
      const existingCategory = await this.prisma.category.findFirst({
        where: {
          slug: updateCategoryDto.slug,
          tenantId,
        },
      });

      if (existingCategory && existingCategory.id !== id) {
        throw new ConflictException('Category with this slug already exists');
      }
    }

    if (updateCategoryDto.parentId) {
      if (updateCategoryDto.parentId === id) {
        throw new BadRequestException('Category cannot be its own parent');
      }

      const parent = await this.prisma.category.findFirst({
        where: {
          id: updateCategoryDto.parentId,
          tenantId,
        },
      });

      if (!parent) {
        throw new NotFoundException('Parent category not found');
      }

      const isDescendant = await this.isDescendant(id, updateCategoryDto.parentId, tenantId);
      if (isDescendant) {
        throw new BadRequestException('Cannot set category as parent of its descendant');
      }
    }

    const slug = updateCategoryDto.slug || (updateCategoryDto.name ? this.generateSlug(updateCategoryDto.name) : undefined);

    return this.prisma.category.update({
      where: { id },
      data: {
        ...(updateCategoryDto.name && { name: updateCategoryDto.name }),
        ...(slug && { slug }),
        ...(updateCategoryDto.description !== undefined && { description: updateCategoryDto.description }),
        ...(updateCategoryDto.parentId !== undefined && { parentId: updateCategoryDto.parentId }),
        ...(updateCategoryDto.isActive !== undefined && { isActive: updateCategoryDto.isActive }),
        ...(updateCategoryDto.sortOrder !== undefined && { sortOrder: updateCategoryDto.sortOrder }),
      },
      include: {
        parent: true,
        children: {
          where: {
            deletedAt: null,
          },
          orderBy: [
            { sortOrder: 'asc' },
            { name: 'asc' },
          ],
        },
        _count: {
          select: {
            children: true,
          },
        },
      },
    });
  }

  async remove(id: string, tenant?: TenantContext) {
    const category = await this.findOne(id, tenant);
    const tenantWhere = this.buildTenantWhere(tenant);

    const hasChildren = await this.prisma.category.count({
      where: {
        parentId: id,
        deletedAt: null,
        ...tenantWhere,
      },
    });

    if (hasChildren > 0) {
      throw new BadRequestException('Cannot delete category with children. Please delete or move children first.');
    }

    await this.prisma.category.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { message: 'Category deleted successfully' };
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private async isDescendant(categoryId: string, potentialParentId: string, tenantId?: string | null): Promise<boolean> {
    const parent = await this.prisma.category.findFirst({
      where: {
        id: potentialParentId,
        ...(tenantId ? { tenantId } : {}),
      },
      select: { parentId: true },
    });

    if (!parent || !parent.parentId) {
      return false;
    }

    if (parent.parentId === categoryId) {
      return true;
    }

    return this.isDescendant(categoryId, parent.parentId, tenantId);
  }
}

