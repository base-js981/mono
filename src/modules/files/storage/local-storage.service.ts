import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Readable } from 'stream';
import { IStorageService, FileStorageResult } from './storage.interface';

@Injectable()
export class LocalStorageService implements IStorageService {
  private readonly uploadDir: string;

  constructor(private readonly configService: ConfigService) {
    this.uploadDir = this.configService.get<string>('UPLOAD_DIR', './uploads');
  }

  async saveFile(file: Express.Multer.File, userId: string): Promise<FileStorageResult> {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const fileExtension = path.extname(file.originalname);
    const storedFilename = `${this.generateUniqueFilename()}${fileExtension}`;
    const relativePath = path.join(userId, String(year), month, storedFilename);
    const fullPath = path.join(this.uploadDir, relativePath);
    const directory = path.dirname(fullPath);

    try {
      await fs.mkdir(directory, { recursive: true });
      await fs.writeFile(fullPath, file.buffer);
      return {
        path: relativePath,
        storedFilename,
      };
    } catch (error) {
      throw new InternalServerErrorException(`Failed to save file: ${(error as Error).message}`);
    }
  }

  async getFileStream(filePath: string): Promise<Readable> {
    const fullPath = path.join(this.uploadDir, filePath);
    try {
      const fileBuffer = await fs.readFile(fullPath);
      const stream = new Readable();
      stream.push(fileBuffer);
      stream.push(null);
      return stream;
    } catch (error) {
      throw new InternalServerErrorException(`Failed to read file: ${(error as Error).message}`);
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    const fullPath = path.join(this.uploadDir, filePath);
    try {
      await fs.unlink(fullPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw new InternalServerErrorException(`Failed to delete file: ${(error as Error).message}`);
      }
    }
  }

  async getFileUrl(filePath: string): Promise<string> {
    return `/files/${filePath}`;
  }

  private generateUniqueFilename(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }
}

