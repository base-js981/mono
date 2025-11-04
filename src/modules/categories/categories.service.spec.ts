import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { PrismaService } from '../../shared/prisma.service';
import { CreateCategoryDto } from './dtos/create-category.dto';
import { UpdateCategoryDto } from './dtos/update-category.dto';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let prisma: jest.Mocked<PrismaService>;

  const mockTenantContext = {
    id: 'tenant-1',
    slug: 'tenant-1',
    name: 'Tenant 1',
    isActive: true,
  };

  const mockCategory = {
    id: 'cat-1',
    name: 'Test Category',
    slug: 'test-category',
    description: 'Test description',
    parentId: null,
    tenantId: 'tenant-1',
    isActive: true,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    parent: null,
    children: [],
    _count: { children: 0 },
  };

  beforeEach(async () => {
    const mockPrismaService = {
      category: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateCategoryDto = {
      name: 'New Category',
      description: 'New description',
      isActive: true,
      sortOrder: 0,
    };

    it('should create category successfully with auto-generated slug', async () => {
      prisma.category.findFirst.mockResolvedValue(null);
      prisma.category.create.mockResolvedValue({
        ...mockCategory,
        ...createDto,
        slug: 'new-category',
      });

      const result = await service.create(createDto, mockTenantContext);

      expect(result).toBeDefined();
      expect(result.slug).toBe('new-category');
      expect(prisma.category.findFirst).toHaveBeenCalledWith({
        where: { slug: 'new-category', tenantId: 'tenant-1' },
      });
      expect(prisma.category.create).toHaveBeenCalledWith({
        data: {
          name: createDto.name,
          slug: 'new-category',
          description: createDto.description,
          parentId: undefined,
          tenantId: 'tenant-1',
          isActive: true,
          sortOrder: 0,
        },
        include: {
          parent: true,
          children: true,
          _count: { select: { children: true } },
        },
      });
    });

    it('should create category with custom slug', async () => {
      const dtoWithSlug = { ...createDto, slug: 'custom-slug' };
      prisma.category.findFirst.mockResolvedValue(null);
      prisma.category.create.mockResolvedValue({
        ...mockCategory,
        slug: 'custom-slug',
      });

      const result = await service.create(dtoWithSlug, mockTenantContext);

      expect(result.slug).toBe('custom-slug');
    });

    it('should throw ConflictException when slug already exists in tenant', async () => {
      prisma.category.findFirst.mockResolvedValue(mockCategory);

      await expect(service.create(createDto, mockTenantContext)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.category.create).not.toHaveBeenCalled();
    });

    it('should validate parent category exists', async () => {
      const dtoWithParent = { ...createDto, parentId: 'parent-id' };
      prisma.category.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...mockCategory, id: 'parent-id' });
      prisma.category.create.mockResolvedValue({
        ...mockCategory,
        parentId: 'parent-id',
      });

      await service.create(dtoWithParent, mockTenantContext);

      expect(prisma.category.findFirst).toHaveBeenCalledWith({
        where: { id: 'parent-id', tenantId: 'tenant-1' },
      });
    });

    it('should throw NotFoundException when parent category not found', async () => {
      const dtoWithParent = { ...createDto, parentId: 'non-existent' };
      prisma.category.findFirst.mockResolvedValue(null);

      await expect(service.create(dtoWithParent, mockTenantContext)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should return all active categories when no tenant context', async () => {
      const categories = [mockCategory];
      prisma.category.findMany.mockResolvedValue(categories);

      const result = await service.findAll();

      expect(result).toEqual(categories);
      expect(prisma.category.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null },
        include: {
          parent: true,
          _count: { select: { children: true } },
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      });
    });

    it('should filter by tenant when tenant context provided', async () => {
      prisma.category.findMany.mockResolvedValue([mockCategory]);

      await service.findAll(false, mockTenantContext);

      expect(prisma.category.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null, tenantId: 'tenant-1' },
        include: {
          parent: true,
          _count: { select: { children: true } },
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      });
    });

    it('should include deleted when includeDeleted is true', async () => {
      prisma.category.findMany.mockResolvedValue([mockCategory]);

      await service.findAll(true, mockTenantContext);

      expect(prisma.category.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1' },
        include: {
          parent: true,
          _count: { select: { children: true } },
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      });
    });
  });

  describe('findOne', () => {
    it('should return category when found', async () => {
      const categoryWithChildren = {
        ...mockCategory,
        children: [],
        _count: { children: 0 },
      };
      (prisma.category.findFirst as unknown as jest.Mock).mockResolvedValue(categoryWithChildren);

      const result = await service.findOne('cat-1', mockTenantContext);

      expect(result).toBeDefined();
      expect(prisma.category.findFirst).toHaveBeenCalledWith({
        where: { id: 'cat-1', deletedAt: null, tenantId: 'tenant-1' },
        include: {
          parent: true,
          children: {
            where: { deletedAt: null },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          },
          _count: { select: { children: true } },
        },
      });
    });

    it('should throw NotFoundException when category not found', async () => {
      (prisma.category.findFirst as unknown as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne('non-existent', mockTenantContext)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    const updateDto: UpdateCategoryDto = {
      name: 'Updated Category',
      description: 'Updated description',
    };

    it('should update category successfully', async () => {
      const updatedCategory = {
        ...mockCategory,
        ...updateDto,
        children: [],
        _count: { children: 0 },
      };
      (prisma.category.findFirst as unknown as jest.Mock)
        .mockResolvedValueOnce(mockCategory)
        .mockResolvedValueOnce(null);
      (prisma.category.update as unknown as jest.Mock).mockResolvedValue(updatedCategory);

      const result = await service.update('cat-1', updateDto, mockTenantContext);

      expect(result).toBeDefined();
      expect(prisma.category.update).toHaveBeenCalled();
    });

    it('should throw ConflictException when new slug already exists', async () => {
      const duplicateCategory = { ...mockCategory, id: 'cat-2', slug: 'new-slug' };
      (prisma.category.findFirst as unknown as jest.Mock)
        .mockResolvedValueOnce(mockCategory)
        .mockResolvedValueOnce(duplicateCategory);

      const dtoWithSlug = { ...updateDto, slug: 'new-slug' };
      await expect(service.update('cat-1', dtoWithSlug, mockTenantContext)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should validate parent category in same tenant', async () => {
      const dtoWithParent = { ...updateDto, parentId: 'parent-id' };
      (prisma.category.findFirst as unknown as jest.Mock)
        .mockResolvedValueOnce(mockCategory)
        .mockResolvedValueOnce(null);

      await expect(service.update('cat-1', dtoWithParent, mockTenantContext)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when setting self as parent', async () => {
      const dtoWithSelfAsParent = { ...updateDto, parentId: 'cat-1' };
      (prisma.category.findFirst as unknown as jest.Mock).mockResolvedValue(mockCategory);

      await expect(
        service.update('cat-1', dtoWithSelfAsParent, mockTenantContext),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should soft delete category successfully', async () => {
      (prisma.category.findFirst as unknown as jest.Mock).mockResolvedValue(mockCategory);
      (prisma.category.count as unknown as jest.Mock).mockResolvedValue(0);
      (prisma.category.update as unknown as jest.Mock).mockResolvedValue({
        ...mockCategory,
        deletedAt: new Date(),
      });

      const result = await service.remove('cat-1', mockTenantContext);

      expect(result.message).toBe('Category deleted successfully');
      expect(prisma.category.count).toHaveBeenCalledWith({
        where: { parentId: 'cat-1', deletedAt: null, tenantId: 'tenant-1' },
      });
      expect(prisma.category.update).toHaveBeenCalledWith({
        where: { id: 'cat-1' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should throw BadRequestException when category has children', async () => {
      (prisma.category.findFirst as unknown as jest.Mock).mockResolvedValue(mockCategory);
      (prisma.category.count as unknown as jest.Mock).mockResolvedValue(2);

      await expect(service.remove('cat-1', mockTenantContext)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.category.update).not.toHaveBeenCalled();
    });
  });
});

