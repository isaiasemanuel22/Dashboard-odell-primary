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
    const result = await pipe.transform(
      { published: false },
      { type: 'body', metatype: UpdateProductDto },
    );

    expect(result).toEqual({ published: false });
  });

  it('preserves published=true', async () => {
    const result = await pipe.transform(
      { published: true },
      { type: 'body', metatype: UpdateProductDto },
    );

    expect(result).toEqual({ published: true });
  });
});
