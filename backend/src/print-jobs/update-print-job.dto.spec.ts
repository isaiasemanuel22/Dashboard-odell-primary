import { ValidationPipe } from '@nestjs/common';
import { UpdatePrintJobDto } from '../common/dto';

describe('UpdatePrintJobDto validation', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  });

  it('acepta null en notes, actualHours y responsibleUserId', async () => {
    const result = (await pipe.transform(
      {
        priority: 'normal',
        notes: null,
        actualHours: null,
        responsibleUserId: null,
      },
      { type: 'body', metatype: UpdatePrintJobDto },
    )) as UpdatePrintJobDto;

    expect(result).toEqual({
      priority: 'normal',
      notes: null,
      actualHours: null,
      responsibleUserId: null,
    });
  });

  it('acepta notes vacío como string', async () => {
    const result = (await pipe.transform(
      { notes: '' },
      { type: 'body', metatype: UpdatePrintJobDto },
    )) as UpdatePrintJobDto;

    expect(result.notes).toBe('');
  });

  it('rechaza actualHours no numérico', async () => {
    await expect(
      pipe.transform(
        { actualHours: 'abc' },
        { type: 'body', metatype: UpdatePrintJobDto },
      ),
    ).rejects.toBeTruthy();
  });

  it('rechaza campos no whitelisted', async () => {
    await expect(
      pipe.transform(
        { status: 'POR_HACER', foo: 1 },
        { type: 'body', metatype: UpdatePrintJobDto },
      ),
    ).rejects.toBeTruthy();
  });
});
