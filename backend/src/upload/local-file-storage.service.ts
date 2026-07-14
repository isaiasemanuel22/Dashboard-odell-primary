import { Injectable } from '@nestjs/common';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { FileStorage } from './file-storage.interface';
import { UPLOADS_DIR } from './upload.paths';

@Injectable()
export class LocalFileStorageService implements FileStorage {
  readonly uploadsDir = UPLOADS_DIR;

  ensureReady(): void {
    if (!existsSync(this.uploadsDir)) {
      mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  saveUploadedFile(file: Express.Multer.File) {
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
