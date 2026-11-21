import { createHmac, timingSafeEqual } from 'node:crypto';

/** Valida X-Hub-Signature-256 (HMAC SHA-256 del cuerpo crudo con el App Secret). */
export function verifyMetaSignature(
  rawBody: Buffer | undefined,
  header: string | undefined,
  secret: string,
): boolean {
  if (!rawBody || !header?.startsWith('sha256=')) return false;
  const expected = Buffer.from(
    createHmac('sha256', secret).update(rawBody).digest('hex'),
  );
  const received = Buffer.from(header.slice('sha256='.length));
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}
