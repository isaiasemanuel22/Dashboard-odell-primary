export interface StoredFile {
  filename: string;
  publicUrl: string;
  absolutePath: string;
}

export interface FileStorage {
  readonly uploadsDir: string;
  ensureReady(): void;
  saveUploadedFile(file: Express.Multer.File): StoredFile;
  deleteFile(absolutePath: string): void;
}

export const FILE_STORAGE = Symbol('FILE_STORAGE');
