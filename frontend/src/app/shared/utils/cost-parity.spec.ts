import {
  FilamentType,
  MachineProfileRole,
  ProductType,
} from '../../core/models';
import { GeneralSettings, Supply, SupplyCategory } from '../../core/models';
import {
  averageFilamentPriceByType,
  resolveFilamentMaterialPrice,
} from './material-type-price.util';
import { calculateErrorMarginCost, priceFromCostAndMargin } from './pricing.util';
import { calcPurgeCost } from './cost-material.util';
import {
  calculateMachineOverhead,
  normalizeMachineProfiles,
  selectPrintProfileForCost,
} from './machine-profile.util';
import { formatFileSizeEsAr } from './file-size.util';
import {
  packagingPriceFromValue,
  supplyCostFromValue,
  supplyErrorFromValue,
  supplyLinesPrice,
  supplyLinesValue,
  supplyPriceFromValue,
} from './supply-line-value.util';
import {
  storedWholesaleFloorApplied,
  wholesaleFloorApplied,
  wholesalePriceFromList,
} from './wholesale-example.util';

/**
 * Misma tabla que `backend/src/settings/cost-material.parity.spec.ts`.
 * No une los motores: fija los dos cálculos que hoy coinciden.
 */
describe('paridad de costo con el API', () => {
  it('promedia el precio por kilo del mismo tipo', () => {
    const settings = {
      filamentPrices: [
        { materialType: FilamentType.PLA, pricePerKg: 10000 },
        { materialType: FilamentType.PLA, pricePerKg: 30000 },
        { materialType: FilamentType.ABS, pricePerKg: 99999 },
      ],
    } as GeneralSettings;

    expect(averageFilamentPriceByType(settings, FilamentType.PLA)).toBe(20000);
    expect(averageFilamentPriceByType(settings, FilamentType.PETG)).toBeNull();
  });

  it('redondea el margen de error sobre material, luz, máquina y purga', () => {
    expect(calculateErrorMarginCost(100, 20, 30, 10)).toBe(15);
    expect(calculateErrorMarginCost(100, 20, 30, 0)).toBe(0);
    expect(calculateErrorMarginCost(100, 20, 30, 150)).toBe(150);
    expect(calculateErrorMarginCost(10, 0, 0, 33)).toBe(3);
    expect(calculateErrorMarginCost(100, 20, 30, 10, 50)).toBe(20);
  });

  it('costea con el promedio de Insumos y cae a Ajustes sin precio', () => {
    const settings = {
      filamentTypeAverages: { [FilamentType.PLA]: 10036 },
    } as unknown as GeneralSettings;
    const supplies = [
      { category: SupplyCategory.FDM, filamentType: FilamentType.PLA, unit: 'kg', unitPrice: 5000 },
      { category: SupplyCategory.FDM, filamentType: FilamentType.PLA, unit: 'g', unitPrice: 7 },
      { category: SupplyCategory.FDM, filamentType: FilamentType.PLA, unit: 'kg', unitPrice: 0 },
    ] as unknown as Supply[];

    expect(
      resolveFilamentMaterialPrice(settings, FilamentType.PLA, supplies),
    ).toEqual({ price: 6000, source: 'supplies' });
    expect(
      resolveFilamentMaterialPrice(settings, FilamentType.PLA, []),
    ).toEqual({ price: 10036, source: 'settings' });
  });

  it('calcula purga AMS con promedio simple de precios por fila', () => {
    const settings = {
      filamentTypeAverages: {
        [FilamentType.PLA]: 20000,
        [FilamentType.PETG]: 14000,
      },
    } as GeneralSettings;

    // 9 g × ((20000+14000)/2) / 1000 = 9 × 17 = 153
    expect(
      calcPurgeCost(
        9,
        {
          filaments: [
            { id: 'a', filamentType: FilamentType.PLA, grams: 30 },
            { id: 'b', filamentType: FilamentType.PETG, grams: 70 },
          ],
        },
        settings,
      ),
    ).toBe(153);

    expect(calcPurgeCost(0, { filamentType: FilamentType.PLA }, settings)).toBe(
      0,
    );
    expect(
      calcPurgeCost(null, { filamentType: FilamentType.PLA }, settings),
    ).toBe(0);
    expect(
      calcPurgeCost(10, { filamentType: FilamentType.PLA }, settings),
    ).toBe(200);
  });

  it('con impresora preferida válida usa ese perfil (no costBase)', () => {
    const settings = {
      electricityCostPerKwh: 100,
      machineProfiles: normalizeMachineProfiles([
        {
          id: 'a1-1',
          name: 'A1 #1',
          role: MachineProfileRole.PRINT,
          watts: 1000,
          costPerHour: 150,
          productType: ProductType.FDM,
          costBase: true,
        },
        {
          id: 'a1-2',
          name: 'A1 #2',
          role: MachineProfileRole.PRINT,
          watts: 2000,
          costPerHour: 300,
          productType: ProductType.FDM,
        },
      ]),
    } as GeneralSettings;

    expect(
      selectPrintProfileForCost(settings, ProductType.FDM, 'a1-2')?.id,
    ).toBe('a1-2');
    const overhead = calculateMachineOverhead(
      settings,
      ProductType.FDM,
      { printTimeHours: 1 },
      'a1-2',
    );
    expect(overhead.energyCost).toBe(200);
    expect(overhead.machineCost).toBe(300);
  });

  it('formatea tamaños de archivo con coma es-AR', () => {
    expect(formatFileSizeEsAr(1126)).toBe('1,1 KB');
    expect(formatFileSizeEsAr(840 * 1024)).toBe('840 KB');
    expect(formatFileSizeEsAr(1.2 * 1024 * 1024)).toBe('1,2 MB');
  });

  it('cobra los insumos a costo × 2 y redondea', () => {
    const lines = [{ id: 'l1', supplyId: 's1', quantity: 1 }];
    expect(supplyLinesValue(lines, () => 1500)).toBe(1500);
    expect(supplyLinesPrice(lines, () => 1500)).toBe(3000);
    expect(supplyPriceFromValue(801)).toBe(1602);
    expect(supplyPriceFromValue(0)).toBe(0);
  });

  it('margen de error del insumo: remera $3000 / 10 % → costo 3300, precio 6300 (§16.3)', () => {
    const lines = [{ id: 'l1', supplyId: 'remera', quantity: 1 }];
    expect(supplyLinesValue(lines, () => 3000)).toBe(3000);
    expect(supplyErrorFromValue(3000, 10)).toBe(300);
    expect(supplyCostFromValue(3000, 10)).toBe(3300);
    expect(supplyPriceFromValue(3000, 10)).toBe(6300);
    expect(supplyLinesPrice(lines, () => 3000, 10)).toBe(6300);
    // Con margen 0, igual que antes.
    expect(supplyCostFromValue(3000, 0)).toBe(3000);
    expect(supplyPriceFromValue(3000, 0)).toBe(6000);
    // Clamp 100 %: error = valor entero; precio = 6000 + 3000.
    expect(supplyPriceFromValue(3000, 150)).toBe(9000);
  });

  it('packaging: costo = valor, precio = valor × 1,25 sin margen de error (§27.2)', () => {
    const lines = [{ id: 'l1', supplyId: 'caja', quantity: 2 }];
    const value = supplyLinesValue(lines, () => 400);
    expect(value).toBe(800);
    expect(packagingPriceFromValue(value)).toBe(1000);
    expect(packagingPriceFromValue(0)).toBe(0);
    // Redondeo una sola vez sobre el valor total (paridad con el API).
    expect(packagingPriceFromValue(801)).toBe(1001);
    expect(packagingPriceFromValue(3)).toBe(4);
  });

  it('el mayorista nunca baja de costo + 10 % ni supera la lista', () => {
    // Taza estampada: lista 746 + 2.250 = 2.996 → 20 % = 2.397 (costo 1.973 × 1,1 = 2.170).
    expect(wholesalePriceFromList(2996, 20, 1973)).toBe(2397);
    expect(wholesalePriceFromList(1200, 20, 1000)).toBe(1100);
    expect(wholesaleFloorApplied(1200, 20, 1000)).toBe(true);
    expect(wholesalePriceFromList(1000, 20, 1000)).toBe(1000);
    expect(wholesalePriceFromList(1200, 20, 0)).toBe(960);
    expect(wholesalePriceFromList(1200, 20)).toBe(960);
    expect(wholesaleFloorApplied(1200, 20, undefined)).toBe(false);
  });

  it('con la lista por debajo del costo no se muestra «ajustado al mínimo»', () => {
    expect(wholesaleFloorApplied(3934, 20, 4467)).toBe(false);
    expect(
      storedWholesaleFloorApplied({
        unitPrice: 1100,
        listUnitPrice: 1200,
        unitCost: 1000,
      }),
    ).toBe(true);
    expect(
      storedWholesaleFloorApplied({
        unitPrice: 3934,
        listUnitPrice: 3934,
        unitCost: 4467,
      }),
    ).toBe(false);
  });
});

/**
 * §16.3 — Leyenda «Calculado» en línea de pedido/presupuesto con insumos.
 *
 * Los insumos no llevan el margen del área: se extraen del costo total antes
 * de aplicar el margen, y se suman al precio con su propia fórmula (valor × 2 + error).
 *
 * procesoCostoTotal = unitCost − supplyValue − supplyError
 * calculado = priceFromCostAndMargin(procesoCostoTotal, margin, labor)
 *           + supplyPriceFromValue(supplyValue, errorPercent)
 *
 * Mismo cálculo que syncEstampadoQuotePricing / syncFdmQuotePricing (líneas de pedido).
 */
describe('calculatedUnitPrice con insumos (§16.3): margen solo sobre el proceso', () => {
  // Escenario: taza $2.500, error 30 %, margen área 100 %.
  // Proceso: processCostNoLabor=500, labor=500 → processCost=1000.
  // totalCost = 1000 + supplyCostFromValue(2500, 30) = 1000 + 3250 = 4250.

  const supplyValue = 2500;
  const errorPercent = 30;
  const areaMargin = 100;
  const labor = 500;

  it('supplyError = 30 % de $2.500 = $750', () => {
    expect(supplyErrorFromValue(supplyValue, errorPercent)).toBe(750);
  });

  it('extrae el insumo del costo total y recalcula: precio correcto $7.250 (no $8.000)', () => {
    const totalCost = 1000 + supplyCostFromValue(supplyValue, errorPercent); // 4250

    // Fórmula correcta (§16.3): margen solo sobre el proceso.
    const supplyError = supplyErrorFromValue(supplyValue, errorPercent);     // 750
    const processCost = totalCost - supplyValue - supplyError;               // 1000
    const correct =
      priceFromCostAndMargin(processCost, areaMargin, labor) +
      supplyPriceFromValue(supplyValue, errorPercent);
    // = (1000-500)×2+500 + (5000+750) = 1500 + 5750 = 7250
    expect(correct).toBe(7250);

    // Fórmula incorrecta (aplica margen sobre todo el costo, incluido insumo y su error).
    const wrong = priceFromCostAndMargin(totalCost, areaMargin, labor);
    // = (4250-500)×2+500 = 7500+500 = 8000
    expect(wrong).toBe(8000);

    // La diferencia es exactamente el supplyError cuando el margen es 100 % (§16.3).
    expect(wrong - correct).toBe(supplyError);
  });

  it('sin insumos la fórmula no cambia: priceFromCostAndMargin normal', () => {
    // processCost=1000, margen 100%, labor 500 → (500)×2+500 = 1500.
    expect(priceFromCostAndMargin(1000, areaMargin, labor)).toBe(1500);
  });

  it('con insumos sin precio (valor=0) el resultado es igual a sin insumos', () => {
    const noSupplyPrice = 0;
    const supplyError = supplyErrorFromValue(noSupplyPrice, errorPercent);   // 0
    const processCost = 1000 - noSupplyPrice - supplyError;                  // 1000
    const result =
      priceFromCostAndMargin(processCost, areaMargin, labor) +
      supplyPriceFromValue(noSupplyPrice, errorPercent);
    expect(result).toBe(1500);
  });
});
