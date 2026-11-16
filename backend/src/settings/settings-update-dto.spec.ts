import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  UpdateColorConfigDto,
  UpdateFilamentPriceDto,
  UpdateMachineCostEntryDto,
  UpdatePowerConsumptionEntryDto,
  UpdateResinPriceDto,
} from '../common/dto';

describe('DTOs de PATCH de Ajustes', () => {
  async function props(cls: new () => object, body: object) {
    const errors = await validate(plainToInstance(cls, body));
    return errors.map((e) => e.property);
  }

  it('rechaza precios y costos negativos', async () => {
    expect(await props(UpdateFilamentPriceDto, { pricePerKg: -1 })).toEqual([
      'pricePerKg',
    ]);
    expect(await props(UpdateResinPriceDto, { pricePerLiter: -5 })).toEqual([
      'pricePerLiter',
    ]);
    expect(await props(UpdateMachineCostEntryDto, { costPerHour: -1 })).toEqual(
      ['costPerHour'],
    );
    expect(await props(UpdatePowerConsumptionEntryDto, { watts: -1 })).toEqual([
      'watts',
    ]);
  });

  it('rechaza tipos incorrectos y nombres larguísimos', async () => {
    expect(await props(UpdateFilamentPriceDto, { pricePerKg: 'x' })).toEqual([
      'pricePerKg',
    ]);
    expect(
      await props(UpdateColorConfigDto, { name: 'a'.repeat(300) }),
    ).toEqual(['name']);
  });

  it('acepta cuerpos parciales válidos', async () => {
    expect(await props(UpdateFilamentPriceDto, { pricePerKg: 100 })).toEqual(
      [],
    );
    expect(await props(UpdateColorConfigDto, {})).toEqual([]);
  });
});
