import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

/** Directorio temporal para recibir uploads antes de enviarlos a Firebase. */
export const UPLOADS_DIR = join(process.cwd(), 'uploads');

export function ensureUploadsDir(): string {
  if (!existsSync(UPLOADS_DIR)) {
    mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  return UPLOADS_DIR;
}
