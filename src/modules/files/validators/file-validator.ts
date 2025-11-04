import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FileValidator {
  private readonly maxFileSize: number;
  private readonly allowedMimeTypes: Set<string>;

  constructor(private readonly configService: ConfigService) {
    this.maxFileSize = this.configService.get<number>('MAX_FILE_SIZE', 10485760); // 10MB default
    const allowedTypes = this.configService.get<string>(
      'ALLOWED_FILE_TYPES',
      'image/jpeg,image/png,image/gif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    this.allowedMimeTypes = new Set(allowedTypes.split(',').map((type: string) => type.trim()));
  }

  validateFile(file: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    if (file.size > this.maxFileSize) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${this.maxFileSize / 1048576}MB`,
      );
    }

    if (!this.allowedMimeTypes.has(file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} is not allowed. Allowed types: ${Array.from(this.allowedMimeTypes).join(', ')}`,
      );
    }
  }

  validateFiles(files: Express.Multer.File[]): void {
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one file is required');
    }

    files.forEach((file) => this.validateFile(file));
  }

  sanitizeFilename(filename: string): string {
    return filename.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 255);
  }
}

