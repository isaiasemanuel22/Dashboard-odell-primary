import {
  isPersistableProductImageUrl,
  normalizeProductImages,
  validateProductImageUrls,
} from './product-image.util';
import { BadRequestException } from '@nestjs/common';

describe('product-image.util', () => {
  it('filtra URLs que no sean https al normalizar', () => {
    expect(
      normalizeProductImages([
        '/uploads/foo.jpg',
        'http://example.com/foo.jpg',
        'https://firebasestorage.googleapis.com/v0/b/x/o/y?alt=media',
      ]),
    ).toEqual(['https://firebasestorage.googleapis.com/v0/b/x/o/y?alt=media']);
  });

  it('rechaza URLs que no sean https al validar', () => {
    expect(() =>
      validateProductImageUrls(['/uploads/foo.jpg']),
    ).toThrow(BadRequestException);
    expect(() =>
      validateProductImageUrls(['http://example.com/foo.jpg']),
    ).toThrow(BadRequestException);
  });

  it('acepta URLs https', () => {
    expect(() =>
      validateProductImageUrls(
        ['https://firebasestorage.googleapis.com/v0/b/x/o/y?alt=media'],
      ),
    ).not.toThrow();
  });

  it('detecta URLs persistibles', () => {
    expect(
      isPersistableProductImageUrl(
        'https://firebasestorage.googleapis.com/v0/b/x/o/y?alt=media',
      ),
    ).toBe(true);
    expect(isPersistableProductImageUrl('/uploads/foo.jpg')).toBe(false);
  });
});
