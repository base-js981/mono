import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { PrismaModule } from '../../shared/prisma.module';
import { LocalStorageService } from './storage/local-storage.service';
import { S3StorageService } from './storage/s3-storage.service';
import type { IStorageService } from './storage/storage.interface';
import { FileValidator } from './validators/file-validator';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [FilesController],
  providers: [
    FileValidator,
    {
      provide: 'STORAGE_SERVICE',
      useFactory: (configService: ConfigService): IStorageService => {
        const storageType = configService.get<string>('STORAGE_TYPE', 'local');

        if (storageType === 's3' || storageType === 'minio') {
          return new S3StorageService(configService);
        }

        return new LocalStorageService(configService);
      },
      inject: [ConfigService],
    },
    FilesService,
  ],
  exports: [FilesService],
})
export class FilesModule {}

