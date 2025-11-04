import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import { IStorageService, FileStorageResult } from './storage.interface';

@Injectable()
export class S3StorageService implements IStorageService {
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly region: string;

  constructor(private readonly configService: ConfigService) {
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');
    const endpoint = this.configService.get<string>('AWS_S3_ENDPOINT');
    const forcePathStyle = this.configService.get<boolean>('AWS_S3_FORCE_PATH_STYLE', true);

    if (!accessKeyId || !secretAccessKey) {
      throw new Error('AWS credentials are required for S3 storage');
    }

    this.region = this.configService.get<string>('AWS_REGION', 'us-east-1') ?? 'us-east-1';
    const bucket = this.configService.get<string>('AWS_S3_BUCKET');

    if (!bucket) {
      throw new Error('AWS_S3_BUCKET is required');
    }

    this.bucket = bucket;

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      ...(endpoint && {
        endpoint,
        forcePathStyle,
      }),
    });
  }

  async saveFile(file: Express.Multer.File, userId: string): Promise<FileStorageResult> {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const fileExtension = this.getFileExtension(file.originalname);
    const storedFilename = `${this.generateUniqueFilename()}${fileExtension}`;
    const key = `${userId}/${year}/${month}/${storedFilename}`;

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        Metadata: {
          originalFilename: file.originalname,
          uploadedBy: userId,
        },
      });

      await this.s3Client.send(command);

      return {
        path: key,
        storedFilename,
      };
    } catch (error) {
      throw new InternalServerErrorException(`Failed to upload file to S3: ${(error as Error).message}`);
    }
  }

  async getFileStream(filePath: string): Promise<Readable> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: filePath,
      });

      const response = await this.s3Client.send(command);

      if (!response.Body) {
        throw new InternalServerErrorException('File not found in S3');
      }

      return response.Body as Readable;
    } catch (error) {
      throw new InternalServerErrorException(`Failed to get file from S3: ${(error as Error).message}`);
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: filePath,
      });

      await this.s3Client.send(command);
    } catch (error) {
      throw new InternalServerErrorException(`Failed to delete file from S3: ${(error as Error).message}`);
    }
  }

  async getFileUrl(filePath: string): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: filePath,
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
      return signedUrl;
    } catch (error) {
      throw new InternalServerErrorException(`Failed to generate file URL: ${(error as Error).message}`);
    }
  }

  private generateUniqueFilename(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  private getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot !== -1 ? filename.substring(lastDot) : '';
  }
}

