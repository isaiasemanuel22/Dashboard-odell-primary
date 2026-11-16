import { BadRequestException } from '@nestjs/common';
import { PaperType } from '../common/enums';
import { CostCalculatorService } from '../settings/cost-calculator.service';
import { createEmptyState } from '../store/store.seed';
import { StoreService } from '../store/store.service';
import { ImpresosService } from './impresos.service';

describe('ImpresosService (pliego)', () => {
  let service: ImpresosService;
  let store: StoreService;

  beforeEach(() => {
    store = new StoreService();
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

  it('rechaza borrar un impreso usado por un producto', () => {
    const created = service.create({
      name: 'Chico',
      paperType: PaperType.DTF,
      widthCm: 10,
      lengthCm: 10,
      heightCm: 0,
    });
    store.products.push({
      id: 'p1',
      estampadoPrints: [
        { id: 'pr1', paperType: PaperType.DTF, impresoId: created.id },
      ],
    } as never);
    expect(() => service.remove(created.id)).toThrow(
      'No se puede eliminar: hay productos usando este impreso',
    );
    store.products.length = 0;
    expect(() => service.remove(created.id)).not.toThrow();
  });

  it('rechaza borrar un impreso usado por impresoId directo', () => {
    const created = service.create({
      name: 'Otro',
      paperType: PaperType.DTF,
      widthCm: 10,
      lengthCm: 10,
      heightCm: 0,
    });
    store.products.push({ id: 'p2', impresoId: created.id } as never);
    expect(() => service.remove(created.id)).toThrow(BadRequestException);
  });
});
