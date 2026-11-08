import { ValidationPipe } from '@nestjs/common';
import { AdjustSpoolDto, MoveSpoolDto, OpenSpoolDto } from './spool.dto';

describe('Spool DTO validation', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  });

  it('acepta OpenSpoolDto con location.kind printer', async () => {
    const result = (await pipe.transform(
      {
        supplyId: 'sup-1',
        grams: 1000,
        location: { kind: 'printer', printerId: 'p-1', slot: 2 },
      },
      { type: 'body', metatype: OpenSpoolDto },
    )) as OpenSpoolDto;

    expect(result.location).toEqual({
      kind: 'printer',
      printerId: 'p-1',
      slot: 2,
    });
  });

  it('acepta MoveSpoolDto con location.kind shelf', async () => {
    const result = (await pipe.transform(
      {
        location: { kind: 'shelf', text: 'Bolsa con desecante' },
      },
      { type: 'body', metatype: MoveSpoolDto },
    )) as MoveSpoolDto;

    expect(result.location).toEqual({
      kind: 'shelf',
      text: 'Bolsa con desecante',
    });
  });

  it('rechaza slot fuera de 1..4', async () => {
    await expect(
      pipe.transform(
        {
          supplyId: 'sup-1',
          location: { kind: 'printer', printerId: 'p-1', slot: 5 },
        },
        { type: 'body', metatype: OpenSpoolDto },
      ),
    ).rejects.toBeTruthy();
  });

  it('rechaza shelf sin text', async () => {
    await expect(
      pipe.transform(
        { location: { kind: 'shelf' } },
        { type: 'body', metatype: MoveSpoolDto },
      ),
    ).rejects.toBeTruthy();
  });

  it('rechaza kind inválido', async () => {
    await expect(
      pipe.transform(
        { location: { kind: 'caja', text: 'x' } },
        { type: 'body', metatype: MoveSpoolDto },
      ),
    ).rejects.toBeTruthy();
  });

  it('rechaza campos no whitelisted en location', async () => {
    await expect(
      pipe.transform(
        {
          location: {
            kind: 'shelf',
            text: 'Estante A',
            extra: true,
          },
        },
        { type: 'body', metatype: MoveSpoolDto },
      ),
    ).rejects.toBeTruthy();
  });

  it('acepta AdjustSpoolDto con remainingGrams', async () => {
    const result = (await pipe.transform(
      { remainingGrams: 250 },
      { type: 'body', metatype: AdjustSpoolDto },
    )) as AdjustSpoolDto;
    expect(result.remainingGrams).toBe(250);
  });
});
