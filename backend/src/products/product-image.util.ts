import { BadRequestException } from '@nestjs/common';

/** En producción solo persistimos URLs https (Firebase Storage). */
export function normalizeProductImages(images: string[] | undefined): string[] {
  if (!images?.length) return [];
  if (process.env.NODE_ENV !== 'production') {
    return images.filter((url) => !!url?.trim());
  }
  return images.filter((url) => isPersistableProductImageUrl(url));
}

export function validateProductImageUrls(
  images: string[] | undefined,
  isProduction: boolean,
): void {
  if (!images?.length || !isProduction) return;

  for (const url of images) {
    const trimmed = url?.trim() ?? '';
    if (!trimmed) continue;

    if (trimmed.startsWith('/uploads/')) {
      throw new BadRequestException(
        'Las imágenes en /uploads no se guardan en producción. Volvé a subir las fotos para usar Firebase Storage.',
      );
    }

    if (!isPersistableProductImageUrl(trimmed)) {
      throw new BadRequestException(
        'En producción cada imagen debe ser una URL pública https (Firebase Storage).',
      );
    }
  }
}

export function isPersistableProductImageUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  return /^https:\/\//i.test(url.trim());
}
