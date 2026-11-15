import { ValidationPipe } from '@nestjs/common';
import { UpdateProductDto } from '../common/dto';

describe('UpdateProductDto validation', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  });

  it('preserves published=false', async () => {
    const result: unknown = await pipe.transform(
      { published: false },
      { type: 'body', metatype: UpdateProductDto },
    );

    expect(result).toEqual({ published: false });
  });

  it('preserves published=true', async () => {
    const result: unknown = await pipe.transform(
      { published: true },
      { type: 'body', metatype: UpdateProductDto },
    );

    expect(result).toEqual({ published: true });
  });
  describe('descuento propio del producto', () => {
    const run = (body: Record<string, unknown>) =>
      pipe.transform(body, { type: 'body', metatype: UpdateProductDto });

    it('acepta un porcentaje de 0 a 99 o un monto fijo', async () => {
      await expect(run({ discountPercent: 15 })).resolves.toEqual({
        discountPercent: 15,
      });
      await expect(run({ discountAmount: 1000 })).resolves.toEqual({
        discountAmount: 1000,
      });
      await expect(
        run({ discountPercent: null, discountAmount: 500 }),
      ).resolves.toBeDefined();
    });

    it('rechaza porcentaje fuera de rango y montos negativos', async () => {
      await expect(run({ discountPercent: 100 })).rejects.toBeDefined();
      await expect(run({ discountPercent: -1 })).rejects.toBeDefined();
      await expect(run({ discountAmount: -5 })).rejects.toBeDefined();
    });

    it('rechaza porcentaje y monto a la vez', async () => {
      await expect(
        run({ discountPercent: 10, discountAmount: 500 }),
      ).rejects.toBeDefined();
    });
  });
});
