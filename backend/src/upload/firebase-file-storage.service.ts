import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { readFileSync, unlinkSync } from 'fs';
import { getStorage } from 'firebase-admin/storage';
import { FirebaseAdminService } from '../auth/firebase-admin.service';
import { FileStorage } from './file-storage.interface';
import { UPLOADS_DIR, ensureUploadsDir } from './upload.paths';

@Injectable()
export class FirebaseFileStorageService implements FileStorage {
  private readonly logger = new Logger(FirebaseFileStorageService.name);
  readonly uploadsDir = UPLOADS_DIR;

  constructor(private readonly firebaseAdmin: FirebaseAdminService) {}

  ensureReady(): void {
    ensureUploadsDir();
  }

  async saveUploadedFile(file: Express.Multer.File) {
    const bucketName = this.firebaseAdmin.getStorageBucket();
    if (!this.firebaseAdmin.isEnabled() || !bucketName) {
      throw new Error('Firebase Storage no está configurado');
    }

    const safeName = file.originalname.replace(/[^\w.\-]+/g, '_');
    const filename = `${Date.now()}-${safeName}`;
    const objectPath = `products/${filename}`;
    const token = randomUUID();

    try {
      const bucket = getStorage().bucket(bucketName);
      await bucket.file(objectPath).save(readFileSync(file.path), {
        metadata: {
          contentType: file.mimetype,
          metadata: {
            firebaseStorageDownloadTokens: token,
          },
        },
      });
    } catch (error) {
      this.logger.error(
        `Error al subir a Firebase Storage: ${this.errorMessage(error)}`,
      );
      throw this.toUploadException(error, bucketName);
    } finally {
      this.deleteFile(file.path);
    }

    const encodedPath = encodeURIComponent(objectPath);
    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${token}`;

    return {
      filename,
      publicUrl,
      absolutePath: objectPath,
    };
  }

  deleteFile(absolutePath: string): void {
    try {
      unlinkSync(absolutePath);
    } catch {
      // Ignorar error al borrar archivo temporal.
    }
  }

  private toUploadException(error: unknown, bucketName: string): Error {
    const raw = this.errorMessage(error);
    if (/bucket does not exist|notFound/i.test(raw)) {
      return new ServiceUnavailableException(
        `Firebase Storage no está activo (bucket "${bucketName}" inexistente). ` +
          'En Firebase Console → Storage → "Comenzar", y verificá FIREBASE_STORAGE_BUCKET.',
      );
    }
    return error instanceof Error ? error : new Error(raw);
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
