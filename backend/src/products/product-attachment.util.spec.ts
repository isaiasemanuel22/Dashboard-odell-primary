import {
  normalizeProductAttachments,
  sanitizeDocumentAttachments,
} from './product-attachment.util';

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

describe('sanitizeDocumentAttachments', () => {
  const att = (n: number) => ({
    id: `att-${n}`,
    name: `archivo-${n}.pdf`,
    url: `https://example.com/${n}.pdf`,
    mimeType: 'application/pdf',
    size: 10,
  });

  it('acepta hasta 10 adjuntos y rechaza más', () => {
    const ten = Array.from({ length: 10 }, (_, i) => att(i));
    expect(sanitizeDocumentAttachments(ten)).toHaveLength(10);
    expect(() => sanitizeDocumentAttachments([...ten, att(11)])).toThrow();
  });

  it('rechaza URLs no https', () => {
    expect(() =>
      sanitizeDocumentAttachments([{ ...att(1), url: 'http://x.com/a.pdf' }]),
    ).toThrow();
  });
});
