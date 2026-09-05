import { calculatePaperCostFromReferenceSheet } from './paper-cost.util';

describe('paper-cost.util', () => {
  it('calcula costo proporcional al pliego de referencia (DTF UV 6×6 cm)', () => {
    const cost = calculatePaperCostFromReferenceSheet(
      { widthCm: 60, lengthCm: 100, price: 35000 },
      6,
      6,
    );

    expect(cost).toBe(210);
  });

  it('calcula costo total de 10 stickers como 10 × costo unitario', () => {
    const unit = calculatePaperCostFromReferenceSheet(
      { widthCm: 60, lengthCm: 100, price: 35000 },
      6,
      6,
    );

    expect(unit * 10).toBe(2100);
  });
});
