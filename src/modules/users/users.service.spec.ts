import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../../shared/prisma.service';
import { CreateUserDto } from './dtos/create-user.dto';
import { UpdateUserDto } from './dtos/update-user.dto';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

// Helper function để cast Prisma delegate methods sang jest.Mock
const toMock = <T>(fn: T): jest.Mock => fn as unknown as jest.Mock;

describe('UsersService', () => {
  let service: UsersService;
  let prisma: jest.Mocked<PrismaService>;

  const mockTenantContext = {
    id: 'tenant-1',
    slug: 'tenant-1',
    name: 'Tenant 1',
    isActive: true,
  };

  const mockUser = {
    id: 'user-1',
    email: 'user@example.com',
    name: 'Test User',
    password: 'hashed-password',
    emailVerified: true,
    tenantId: 'tenant-1',
    department: null,
    clearanceLevel: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockUserWithRoles = {
    ...mockUser,
    userRoles: [
      {
        id: 'ur-1',
        userId: 'user-1',
        roleId: 'role-1',
        createdAt: new Date(),
        role: {
          id: 'role-1',
          name: 'USER',
          description: 'Regular user',
          rolePermissions: [
            {
              id: 'rp-1',
              roleId: 'role-1',
              permissionId: 'perm-1',
              permission: {
                id: 'perm-1',
                name: 'user.read',
                resource: 'user',
                action: 'read',
              },
            },
          ],
        },
      },
    ],
  };

  beforeEach(async () => {
    const mockPrismaService = {
      user: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      userRole: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(mockPrismaService)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all users when no tenant context', async () => {
      const expectedUsers = [mockUserWithRoles];
      toMock(prisma.user.findMany).mockResolvedValue(expectedUsers);

      const result = await service.findAll();

      expect(result).toEqual(expectedUsers);
      expect(prisma.user.findMany).toHaveBeenCalledWith({
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
    });

    it('should filter users by tenant when tenant context provided', async () => {
      const expectedUsers = [mockUserWithRoles];
      toMock(prisma.user.findMany).mockResolvedValue(expectedUsers);

      const result = await service.findAll(mockTenantContext);

      expect(result).toEqual(expectedUsers);
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null, tenantId: 'tenant-1' },
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
    });
  });

  describe('findOne', () => {
    it('should return user when found', async () => {
      toMock(prisma.user.findFirst).mockResolvedValue(mockUser);
      toMock(prisma.user.findUnique).mockResolvedValue(mockUserWithRoles);

      const result = await service.findOne('user-1');

      expect(result).toEqual(mockUserWithRoles);
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { id: 'user-1', deletedAt: null },
      });
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
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
    });

    it('should filter by tenant when tenant context provided', async () => {
      toMock(prisma.user.findFirst).mockResolvedValue(mockUser);
      toMock(prisma.user.findUnique).mockResolvedValue(mockUserWithRoles);

      await service.findOne('user-1', mockTenantContext);

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { id: 'user-1', deletedAt: null, tenantId: 'tenant-1' },
      });
    });

    it('should throw NotFoundException when user not found', async () => {
      toMock(prisma.user.findFirst).mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when user is deleted', async () => {
      toMock(prisma.user.findFirst).mockResolvedValue(null);

      await expect(service.findOne('deleted-user')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    const createDto: CreateUserDto = {
      email: 'newuser@example.com',
      name: 'New User',
      password: 'password123',
      emailVerified: false,
    };

    beforeEach(() => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
    });

    it('should create user successfully with tenant context', async () => {
      toMock(prisma.user.findFirst)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...mockUser, ...createDto, id: 'new-user-id' });
      toMock(prisma.user.findUnique).mockResolvedValue(mockUserWithRoles);
      toMock(prisma.user.create).mockResolvedValue({ ...mockUser, ...createDto, id: 'new-user-id' });

      const result = await service.create(createDto, mockTenantContext);

      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 12);
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { email: createDto.email, tenantId: 'tenant-1' },
      });
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: createDto.email,
          name: createDto.name,
          password: 'hashed-password',
          emailVerified: false,
          tenantId: 'tenant-1',
        },
      });
      expect(result).toBeDefined();
    });

    it('should throw BadRequestException when no tenant context', async () => {
      await expect(service.create(createDto)).rejects.toThrow(BadRequestException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when email already exists in tenant', async () => {
      toMock(prisma.user.findFirst).mockResolvedValue(mockUser);

      await expect(service.create(createDto, mockTenantContext)).rejects.toThrow(ConflictException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    const updateDto: UpdateUserDto = {
      name: 'Updated Name',
      email: 'updated@example.com',
    };

    it('should update user successfully', async () => {
      toMock(prisma.user.findFirst)
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockUser);
      toMock(prisma.user.findUnique)
        .mockResolvedValueOnce(mockUserWithRoles)
        .mockResolvedValueOnce({ ...mockUserWithRoles, ...updateDto });
      toMock(prisma.user.update).mockResolvedValue({ ...mockUser, ...updateDto });

      const result = await service.update('user-1', updateDto, mockTenantContext);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          email: updateDto.email,
          name: updateDto.name,
        },
      });
      expect(result).toBeDefined();
    });

    it('should hash password when password is provided', async () => {
      const passwordDto: UpdateUserDto = { password: 'newpassword123' };
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-password');

      toMock(prisma.user.findFirst).mockResolvedValue(mockUser);
      toMock(prisma.user.findUnique).mockResolvedValue(mockUserWithRoles);
      toMock(prisma.user.update).mockResolvedValue(mockUser);

      await service.update('user-1', passwordDto, mockTenantContext);

      expect(bcrypt.hash).toHaveBeenCalledWith('newpassword123', 12);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          password: 'new-hashed-password',
        },
      });
    });

    it('should throw ConflictException when email already exists', async () => {
      toMock(prisma.user.findFirst)
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(mockUser);
      toMock(prisma.user.findUnique).mockResolvedValue(mockUserWithRoles);
      const duplicateUser = { ...mockUser, id: 'user-2', email: 'updated@example.com' };
      toMock(prisma.user.findFirst).mockResolvedValueOnce(duplicateUser);

      await expect(service.update('user-1', updateDto, mockTenantContext)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should not check email uniqueness when email unchanged', async () => {
      const sameEmailDto: UpdateUserDto = { name: 'Updated Name' };
      toMock(prisma.user.findFirst)
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(mockUser);
      toMock(prisma.user.findUnique).mockResolvedValue(mockUserWithRoles);
      toMock(prisma.user.update).mockResolvedValue(mockUser);
      toMock(prisma.user.findFirst).mockResolvedValueOnce(mockUser);

      await service.update('user-1', sameEmailDto, mockTenantContext);

      expect(prisma.user.update).toHaveBeenCalled();
    });
  });

  describe('getUserRoles', () => {
    it('should return user roles', async () => {
      toMock(prisma.user.findFirst).mockResolvedValue(mockUser);
      toMock(prisma.user.findUnique).mockResolvedValue(mockUserWithRoles);

      const result = await service.getUserRoles('user-1', mockTenantContext);

      expect(result).toEqual({
        userId: 'user-1',
        email: 'user@example.com',
        name: 'Test User',
        roles: [
          {
            id: 'role-1',
            name: 'USER',
            description: 'Regular user',
            permissions: ['user.read'],
          },
        ],
      });
    });

    it('should throw NotFoundException when user not found', async () => {
      toMock(prisma.user.findFirst).mockResolvedValue(null);

      await expect(service.getUserRoles('non-existent', mockTenantContext)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('assignRoles', () => {
    it('should assign roles to user', async () => {
      const roleIds = ['role-1', 'role-2'];
      toMock(prisma.user.findFirst).mockResolvedValue(mockUser);
      toMock(prisma.user.findUnique).mockResolvedValue(mockUserWithRoles);
      toMock(prisma.userRole.deleteMany).mockResolvedValue({ count: 1 });
      toMock(prisma.userRole.createMany).mockResolvedValue({ count: 2 });
      toMock(prisma.$transaction).mockImplementation((cb) => cb(prisma));

      await service.assignRoles('user-1', roleIds, mockTenantContext);

      expect(prisma.userRole.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(prisma.userRole.createMany).toHaveBeenCalledWith({
        data: [
          { userId: 'user-1', roleId: 'role-1' },
          { userId: 'user-1', roleId: 'role-2' },
        ],
      });
    });

    it('should remove all roles when empty array provided', async () => {
      toMock(prisma.user.findFirst).mockResolvedValue(mockUser);
      toMock(prisma.user.findUnique).mockResolvedValue(mockUserWithRoles);
      toMock(prisma.userRole.deleteMany).mockResolvedValue({ count: 1 });
      toMock(prisma.$transaction).mockImplementation((cb) => cb(prisma));

      await service.assignRoles('user-1', [], mockTenantContext);

      expect(prisma.userRole.deleteMany).toHaveBeenCalled();
      expect(prisma.userRole.createMany).not.toHaveBeenCalled();
    });
  });

  describe('removeRole', () => {
    it('should remove role from user', async () => {
      toMock(prisma.user.findFirst).mockResolvedValue(mockUser);
      toMock(prisma.userRole.deleteMany).mockResolvedValue({ count: 1 });

      const result = await service.removeRole('user-1', 'role-1', mockTenantContext);

      expect(result).toEqual({ message: 'Role removed successfully' });
      expect(prisma.userRole.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', roleId: 'role-1' },
      });
    });

    it('should throw NotFoundException when role assignment not found', async () => {
      toMock(prisma.user.findFirst).mockResolvedValue(mockUser);
      toMock(prisma.userRole.deleteMany).mockResolvedValue({ count: 0 });

      await expect(service.removeRole('user-1', 'non-existent', mockTenantContext)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('softDelete', () => {
    it('should soft delete user', async () => {
      toMock(prisma.user.findFirst).mockResolvedValue(mockUser);
      toMock(prisma.user.findUnique).mockResolvedValue(mockUserWithRoles);
      const deletedUser = { ...mockUser, deletedAt: new Date() };
      toMock(prisma.user.update).mockResolvedValue(deletedUser);

      const result = await service.softDelete('user-1', mockTenantContext);

      expect(result.deletedAt).toBeDefined();
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should throw NotFoundException when user not found', async () => {
      toMock(prisma.user.findFirst).mockResolvedValue(null);

      await expect(service.softDelete('non-existent', mockTenantContext)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

