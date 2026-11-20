import { buildBelowCalculatedSummary } from './products-alert-summary';

describe('buildBelowCalculatedSummary', () => {
  it('6 recalculables + 1 fijo: total 7 con las dos partes', () => {
    const s = buildBelowCalculatedSummary(6, 1);
    expect(s.title).toBe('7 productos debajo del precio calculado');
    expect(s.recalculableText).toBe('6 se pueden recalcular');
    expect(s.fixedText).toBe('1 tiene precio fijo');
  });

  it('0 fijos: sin la parte de fijos', () => {
    const s = buildBelowCalculatedSummary(3, 0);
    expect(s.title).toBe('3 productos debajo del precio calculado');
    expect(s.fixedText).toBeNull();
    expect(s.recalculableText).toBe('3 se pueden recalcular');
  });

  it('0 recalculables: sin esa parte', () => {
    const s = buildBelowCalculatedSummary(0, 2);
    expect(s.recalculableText).toBeNull();
    expect(s.fixedText).toBe('2 tienen precio fijo');
  });
});
