import { BadRequestException } from '@nestjs/common';
import { ProductAttachment } from '../common/interfaces';
import { normalizeAttachmentMime } from '../upload/upload.validation';
import { isPersistableProductImageUrl } from './product-image.util';

/** Máximo de adjuntos por pedido o presupuesto. */
export const MAX_DOCUMENT_ATTACHMENTS = 10;

export function createProductAttachmentId(): string {
  return `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeProductAttachments(raw: unknown): ProductAttachment[] {
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

/** Valida y normaliza los adjuntos de un pedido o presupuesto (máx. 10). */
export function sanitizeDocumentAttachments(
  raw: ProductAttachment[] | undefined,
): ProductAttachment[] {
  if (!raw?.length) return [];
  if (raw.length > MAX_DOCUMENT_ATTACHMENTS) {
    throw new BadRequestException(
      `Se permiten hasta ${MAX_DOCUMENT_ATTACHMENTS} adjuntos`,
    );
  }
  validateProductAttachments(raw);
  return normalizeProductAttachments(raw);
}

function normalizeOneProductAttachment(
  item: unknown,
): ProductAttachment | null {
  if (!item || typeof item !== 'object') return null;

  const record = item as Record<string, unknown>;
  const url = typeof record.url === 'string' ? record.url.trim() : '';
  if (!isPersistableProductImageUrl(url)) return null;

  const name =
    typeof record.name === 'string' && record.name.trim()
      ? record.name.trim()
      : 'Archivo';
  const rawMime =
    typeof record.mimeType === 'string' ? record.mimeType : undefined;
  const mimeType = normalizeAttachmentMime(name, rawMime);
  const size = Math.max(0, Number(record.size) || 0);
  const id =
    typeof record.id === 'string' && record.id.trim()
      ? record.id.trim()
      : createProductAttachmentId();

  return { id, name, url, mimeType, size };
}
