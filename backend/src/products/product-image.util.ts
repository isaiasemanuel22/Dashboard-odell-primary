import { BadRequestException } from '@nestjs/common';

/** Solo persistimos URLs https (Firebase Storage). */
export function normalizeProductImages(images: string[] | undefined): string[] {
  if (!images?.length) return [];
  return images.filter((url) => isPersistableProductImageUrl(url));
}

export function validateProductImageUrls(images: string[] | undefined): void {
  if (!images?.length) return;

  for (const url of images) {
    const trimmed = url?.trim() ?? '';
    if (!trimmed) continue;

    if (!isPersistableProductImageUrl(trimmed)) {
      throw new BadRequestException(
        'Cada imagen debe ser una URL pública https (Firebase Storage).',
      );
    }
  }
}

export function isPersistableProductImageUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  return /^https:\/\//i.test(url.trim());
}
