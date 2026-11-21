import { createHmac } from 'node:crypto';
import { verifyMetaSignature } from './meta-signature.util';

describe('verifyMetaSignature', () => {
  const body = Buffer.from('{"object":"page"}');
  const sign = (secret: string) =>
    `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

  it('acepta la firma hecha con el mismo secreto', () => {
    expect(verifyMetaSignature(body, sign('secreto'), 'secreto')).toBe(true);
  });

  it('rechaza otro secreto, otro largo, sin prefijo o sin cuerpo', () => {
    expect(verifyMetaSignature(body, sign('otro'), 'secreto')).toBe(false);
    expect(verifyMetaSignature(body, 'sha256=abc', 'secreto')).toBe(false);
    expect(verifyMetaSignature(body, sign('secreto').slice(7), 'secreto')).toBe(
      false,
    );
    expect(verifyMetaSignature(undefined, sign('secreto'), 'secreto')).toBe(
      false,
    );
    expect(verifyMetaSignature(body, undefined, 'secreto')).toBe(false);
  });
});
