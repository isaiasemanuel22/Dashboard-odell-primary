import { ProductAttachment } from '../../core/models';

export function createProductAttachmentId(): string {
  return `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeProductAttachments(
  raw: ProductAttachment[] | undefined | null,
): ProductAttachment[] {
  if (!raw?.length) return [];
  return raw.filter(
    (item) =>
      Boolean(item?.id?.trim()) &&
      Boolean(item?.name?.trim()) &&
      Boolean(item?.url?.trim()),
  );
}
