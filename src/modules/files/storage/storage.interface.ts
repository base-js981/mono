import { Readable } from 'stream';

export interface FileStorageResult {
  path: string;
  storedFilename: string;
}

export interface IStorageService {
  saveFile(file: Express.Multer.File, userId: string): Promise<FileStorageResult>;
  getFileStream(path: string): Promise<Readable>;
  deleteFile(path: string): Promise<void>;
  getFileUrl(path: string): Promise<string>;
}
