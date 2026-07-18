import { Injectable, OnModuleInit } from '@nestjs/common';
import { unlinkSync } from 'fs';
import { FileStorage } from './file-storage.interface';
import { UPLOADS_DIR, ensureUploadsDir } from './upload.paths';

@Injectable()
export class LocalFileStorageService implements FileStorage, OnModuleInit {
  readonly uploadsDir = UPLOADS_DIR;

  onModuleInit(): void {
    this.ensureReady();
  }

  ensureReady(): void {
    ensureUploadsDir();
  }

  async saveUploadedFile(file: Express.Multer.File) {
    return {
      filename: file.filename,
      publicUrl: `/uploads/${file.filename}`,
      absolutePath: file.path,
    };
  }

  deleteFile(absolutePath: string): void {
    try {
      unlinkSync(absolutePath);
    } catch {
      // Ignorar error al borrar archivo inválido.
    }
  }
}
