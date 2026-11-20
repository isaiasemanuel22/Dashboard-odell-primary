import {
  processMarginPercentRounded,
  productProcessMarginRounded,
  totalMarginPercentRounded,
} from './product-margin.util';

describe('márgenes que se muestran (§16.1.1)', () => {
  // Precio del proceso = venta − (MO + precio insumos + precio packaging).
  it('QA taza ×2 calculada: proceso 100 %, total 59 %', () => {
    const nonProcess = 500 + 5750 + 1250;
    expect(processMarginPercentRounded(7822, 161, nonProcess)).toBe(100);
    expect(totalMarginPercentRounded(7822, 4911)).toBe(59);
  });

  it('QA taza ×2 con precio fijo 9.000: proceso 832 %, total 83 %', () => {
    expect(processMarginPercentRounded(9000, 161, 7500)).toBe(832);
    expect(totalMarginPercentRounded(9000, 4911)).toBe(83);
  });

  it('Remera estampada DTF: fijo 25.000 → 189 % / 106 %; calculado 22.190 → 100 % / 83 %', () => {
    expect(processMarginPercentRounded(25000, 3160, 15870)).toBe(189);
    expect(totalMarginPercentRounded(25000, 12130)).toBe(106);
    expect(processMarginPercentRounded(22190, 3160, 15870)).toBe(100);
    expect(totalMarginPercentRounded(22190, 12130)).toBe(83);
  });

  it('Combo Árbol de equilibrio: proceso 182 %, total 151 %', () => {
    expect(processMarginPercentRounded(14518, 4792, 1000)).toBe(182);
    expect(totalMarginPercentRounded(14518, 5792)).toBe(151);
  });

  it('costo 0 → null', () => {
    expect(processMarginPercentRounded(1000, 0, 0)).toBeNull();
    expect(totalMarginPercentRounded(1000, 0)).toBeNull();
  });

  it('producto del catálogo: usa processCost/nonProcessPrice del backend', () => {
    expect(
      productProcessMarginRounded(
        { cost: 4911, processCost: 161, nonProcessPrice: 7500 },
        7822,
      ),
    ).toBe(100);
  });

  it('producto sin esos datos: cae al margen sin mano de obra', () => {
    expect(productProcessMarginRounded({ cost: 1000 }, 1400)).toBe(40);
  });
});
