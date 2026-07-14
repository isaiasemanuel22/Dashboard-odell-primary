import { readFileSync } from 'fs';
import { extname } from 'path';

const IMAGE_SIGNATURES: Array<{ mime: string; bytes: number[]; offset?: number }> =
  [
    { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
    { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
    { mime: 'image/gif', bytes: [0x47, 0x49, 0x46] },
    { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 },
  ];

const ALLOWED_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
]);

export function isAllowedImageExtension(filename: string): boolean {
  const extension = extname(filename).toLowerCase();
  return ALLOWED_EXTENSIONS.has(extension);
}

export function detectImageMime(buffer: Buffer): string | null {
  for (const signature of IMAGE_SIGNATURES) {
    const offset = signature.offset ?? 0;
    if (buffer.length < offset + signature.bytes.length) continue;

    const matches = signature.bytes.every(
      (byte, index) => buffer[offset + index] === byte,
    );
    if (matches) return signature.mime;
  }

  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }

  return null;
}

export function validateUploadedImage(
  file: Express.Multer.File,
): { ok: true; mime: string } | { ok: false; reason: string } {
  if (!isAllowedImageExtension(file.originalname)) {
    return { ok: false, reason: 'Extensión de archivo no permitida' };
  }

  const detectedMime = detectImageMime(file.buffer ?? readFileSync(file.path));
  if (!detectedMime) {
    return { ok: false, reason: 'El archivo no es una imagen válida' };
  }

  if (!file.mimetype.startsWith('image/')) {
    return { ok: false, reason: 'Tipo MIME inválido' };
  }

  return { ok: true, mime: detectedMime };
}
