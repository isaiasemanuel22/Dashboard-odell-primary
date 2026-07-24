import {
  isPersistableProductImageUrl,
  normalizeProductImages,
  validateProductImageUrls,
} from './product-image.util';
import { BadRequestException } from '@nestjs/common';

describe('product-image.util', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('filtra /uploads en producción al normalizar', () => {
    process.env.NODE_ENV = 'production';
    expect(
      normalizeProductImages([
        '/uploads/foo.jpg',
        'https://firebasestorage.googleapis.com/v0/b/x/o/y?alt=media',
      ]),
    ).toEqual(['https://firebasestorage.googleapis.com/v0/b/x/o/y?alt=media']);
  });

  it('conserva /uploads en desarrollo', () => {
    process.env.NODE_ENV = 'development';
    expect(normalizeProductImages(['/uploads/foo.jpg'])).toEqual([
      '/uploads/foo.jpg',
    ]);
  });

  it('rechaza /uploads al validar en producción', () => {
    expect(() =>
      validateProductImageUrls(['/uploads/foo.jpg'], true),
    ).toThrow(BadRequestException);
  });

  it('acepta URLs https en producción', () => {
    expect(() =>
      validateProductImageUrls(
        ['https://firebasestorage.googleapis.com/v0/b/x/o/y?alt=media'],
        true,
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
