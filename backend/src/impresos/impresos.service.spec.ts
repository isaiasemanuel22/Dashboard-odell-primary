import { BadRequestException } from '@nestjs/common';
import { PaperType } from '../common/enums';
import { CostCalculatorService } from '../settings/cost-calculator.service';
import { createEmptyState } from '../store/store.seed';
import { StoreService } from '../store/store.service';
import { ImpresosService } from './impresos.service';

describe('ImpresosService (pliego)', () => {
  let service: ImpresosService;

  beforeEach(() => {
    const store = new StoreService();
    store.applyState(createEmptyState());
    store.generalSettings.paperReferenceSheets.dtf = {
      widthCm: 60,
      lengthCm: 100,
      price: 1000,
    };
    service = new ImpresosService(store, new CostCalculatorService(store));
  });

  it('rechaza una medida que no entra en el pliego', () => {
    expect(() =>
      service.create({
        name: 'Gigante',
        paperType: PaperType.DTF,
        widthCm: 500,
        lengthCm: 500,
        heightCm: 0,
      }),
    ).toThrow(BadRequestException);
  });

  it('acepta una medida que entra girada', () => {
    const created = service.create({
      name: 'Largo',
      paperType: PaperType.DTF,
      widthCm: 90,
      lengthCm: 50,
      heightCm: 0,
    });
    expect(created.widthCm).toBe(90);
  });
});
