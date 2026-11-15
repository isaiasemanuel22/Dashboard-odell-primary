import { EstampadoPrintSpec, ImpresoWithCost, PaperType } from '../../../core/models';
import { ProductCostCalculationService } from '../../../core/services/product-cost-calculation.service';
import { isEstampadoPrintValid } from '../../../shared/utils/estampado.helpers';
import { PrintSpecListLogic } from './print-spec-list.logic';

describe('PrintSpecListLogic: cambiar el papel de una fila', () => {
  const impreso = {
    id: 'imp-1',
    name: 'Pecho 30x25',
    paperType: PaperType.DTF,
    widthCm: 30,
    lengthCm: 25,
    heightCm: 25,
  } as ImpresoWithCost;

  const costService = {
    calculateImpresoPaperCost: (_s: unknown, _p: PaperType, w: number, h: number) => w * h,
  } as unknown as ProductCostCalculationService;

  const settings = { paperPricesPerSqm: {} } as never;

  function paperChange(logic: PrintSpecListLogic, print: EstampadoPrintSpec) {
    const field = (
      logic.config.fields as unknown as Array<{
        name?: string;
        changeFn?: (item: EstampadoPrintSpec) => void;
      }>
    ).find((f) => f.name === 'paperType');
    field?.changeFn?.(print);
  }

  for (const paper of [PaperType.SUBLIMACION, PaperType.DTF_UV]) {
    it(`medida libre 30×25 sigue costeando al pasar a ${paper}`, () => {
      const logic = new PrintSpecListLogic(costService);
      logic.generalSettings = settings;
      logic.impresos = [impreso];
      const print = {
        id: 'p1',
        paperType: paper,
        widthCm: 30,
        lengthCm: 25,
        quantity: 1,
      } as EstampadoPrintSpec;
      paperChange(logic, print);
      expect(isEstampadoPrintValid(print)).toBeTrue();
      expect(logic.paperCost(print)).toBe(750);
    });

    it(`impreso del catálogo 30×25 conserva la medida al pasar a ${paper}`, () => {
      const logic = new PrintSpecListLogic(costService);
      logic.generalSettings = settings;
      logic.impresos = [impreso];
      const print = {
        id: 'p1',
        paperType: PaperType.DTF,
        impresoId: 'imp-1',
        widthCm: 30,
        lengthCm: 25,
        heightCm: 25,
        quantity: 1,
      } as EstampadoPrintSpec;
      print.paperType = paper;
      paperChange(logic, print);
      expect(print.impresoId).toBe('');
      expect(isEstampadoPrintValid(print)).toBeTrue();
      expect(logic.paperCost(print)).toBe(750);
    });
  }
});
