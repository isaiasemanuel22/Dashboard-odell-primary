import {
  detectImageMime,
  isAllowedImageExtension,
} from './upload.validation';

describe('upload.validation', () => {
  it('acepta extensiones permitidas', () => {
    expect(isAllowedImageExtension('foto.jpg')).toBe(true);
    expect(isAllowedImageExtension('foto.exe')).toBe(false);
  });

  it('detecta PNG por magic bytes', () => {
    const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(detectImageMime(buffer)).toBe('image/png');
  });

  it('rechaza contenido no imagen', () => {
    expect(detectImageMime(Buffer.from('not-an-image'))).toBeNull();
  });
});
