import { BadRequestException } from '@nestjs/common';
import { ProductAttachment } from '../common/interfaces';
import { isPersistableProductImageUrl } from './product-image.util';

export function createProductAttachmentId(): string {
  return `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeProductAttachments(
  raw: unknown,
): ProductAttachment[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => normalizeOneProductAttachment(item))
    .filter((item): item is ProductAttachment => item !== null);
}

export function validateProductAttachments(
  attachments: ProductAttachment[] | undefined,
): void {
  if (!attachments?.length) return;

  for (const attachment of attachments) {
    if (!attachment.name?.trim()) {
      throw new BadRequestException('Cada adjunto debe tener un nombre');
    }
    if (!isPersistableProductImageUrl(attachment.url)) {
      throw new BadRequestException(
        'Cada adjunto debe ser una URL pública https (Firebase Storage).',
      );
    }
    if (!attachment.mimeType?.trim()) {
      throw new BadRequestException('Cada adjunto debe indicar el tipo MIME');
    }
    if (Number(attachment.size) < 0) {
      throw new BadRequestException('El tamaño del adjunto es inválido');
    }
  }
}

function normalizeOneProductAttachment(item: unknown): ProductAttachment | null {
  if (!item || typeof item !== 'object') return null;

  const record = item as Record<string, unknown>;
  const url = typeof record.url === 'string' ? record.url.trim() : '';
  if (!isPersistableProductImageUrl(url)) return null;

  const name =
    typeof record.name === 'string' && record.name.trim()
      ? record.name.trim()
      : 'Archivo';
  const mimeType =
    typeof record.mimeType === 'string' && record.mimeType.trim()
      ? record.mimeType.trim()
      : 'application/octet-stream';
  const size = Math.max(0, Number(record.size) || 0);
  const id =
    typeof record.id === 'string' && record.id.trim()
      ? record.id.trim()
      : createProductAttachmentId();

  return { id, name, url, mimeType, size };
}
