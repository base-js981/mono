import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma.service';
import { TenantAwareService } from '../../shared/tenant/tenant-aware.service';
import type { TenantContext } from '../../shared/tenant/tenant-resolver.service';
import type { IStorageService } from './storage/storage.interface';
import { FileValidator } from './validators/file-validator';
import { ListFilesDto } from './dtos/list-files.dto';

@Injectable()
export class FilesService extends TenantAwareService {
  constructor(
    prisma: PrismaService,
    @Inject('STORAGE_SERVICE')
    private readonly storageService: IStorageService,
    private readonly fileValidator: FileValidator,
  ) {
    super(prisma);
  }

  async uploadFile(file: Express.Multer.File, userId: string, tenant?: TenantContext): Promise<any> {
    this.fileValidator.validateFile(file);

    const sanitizedFilename = this.fileValidator.sanitizeFilename(file.originalname);
    const tenantId = this.getTenantId(tenant);

    const storageResult = await this.storageService.saveFile(file, userId);

    const fileRecord = await this.prisma.file.create({
      data: {
        filename: sanitizedFilename,
        storedFilename: storageResult.storedFilename,
        path: storageResult.path,
        mimeType: file.mimetype,
        size: file.size,
        uploadedById: userId,
        tenantId,
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    return fileRecord;
  }

  async uploadMultipleFiles(files: Express.Multer.File[], userId: string, tenant?: TenantContext): Promise<any[]> {
    this.fileValidator.validateFiles(files);

    const uploadPromises = files.map((file) => this.uploadFile(file, userId, tenant));

    return Promise.all(uploadPromises);
  }

  async findAll(dto: ListFilesDto, tenant?: TenantContext) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;
    const tenantWhere = this.buildTenantWhere(tenant);

    const where: any = {
      deletedAt: null,
      ...tenantWhere,
    };

    if (dto.uploadedBy) {
      where.uploadedById = dto.uploadedBy;
    }

    const [files, total] = await Promise.all([
      this.prisma.file.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          uploadedBy: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      }),
      this.prisma.file.count({ where }),
    ]);

    return {
      data: files,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, tenant?: TenantContext) {
    const tenantWhere = this.buildTenantWhere(tenant);
    const file = await this.prisma.file.findFirst({
      where: {
        id,
        deletedAt: null,
        ...tenantWhere,
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    return file;
  }

  async downloadFile(id: string, tenant?: TenantContext) {
    const file = await this.findOne(id, tenant);

    const stream = await this.storageService.getFileStream(file.path);

    return {
      stream,
      filename: file.filename,
      mimeType: file.mimeType,
    };
  }

  async deleteFile(id: string, userId: string, tenant?: TenantContext): Promise<void> {
    const file = await this.findOne(id, tenant);

    if (file.uploadedById !== userId) {
      throw new BadRequestException('You can only delete files you uploaded');
    }

    const tenantId = this.getTenantId(tenant);
    if (tenantId && file.tenantId !== tenantId) {
      throw new BadRequestException('Access denied: Tenant mismatch');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.file.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      try {
        await this.storageService.deleteFile(file.path);
      } catch (error) {
        console.error(`Failed to delete physical file ${file.path}:`, error);
      }
    });
  }

  async getFileUrl(id: string, tenant?: TenantContext): Promise<string> {
    const file = await this.findOne(id, tenant);
    return this.storageService.getFileUrl(file.path);
  }
}

