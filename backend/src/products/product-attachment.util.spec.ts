import { normalizeProductAttachments } from './product-attachment.util';

describe('product-attachment.util', () => {
  it('normaliza adjuntos .3mf a model/3mf con mime vacío u octet-stream', () => {
    const attachments = normalizeProductAttachments([
      {
        id: 'att-1',
        name: 'modelo.3mf',
        url: 'https://example.com/modelo.3mf',
        mimeType: 'application/octet-stream',
        size: 100,
      },
      {
        id: 'att-2',
        name: 'otro.3mf',
        url: 'https://example.com/otro.3mf',
        mimeType: '',
        size: 50,
      },
    ]);

    expect(attachments).toHaveLength(2);
    expect(attachments[0]?.mimeType).toBe('model/3mf');
    expect(attachments[1]?.mimeType).toBe('model/3mf');
  });
});
