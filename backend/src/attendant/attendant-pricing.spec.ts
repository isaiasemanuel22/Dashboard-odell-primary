import { costUsd } from './attendant-pricing';

describe('costUsd', () => {
  it('suma input, output y caché con el precio de Sonnet', () => {
    expect(
      costUsd({
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        cacheReadTokens: 1_000_000,
        cacheWriteTokens: 1_000_000,
      }),
    ).toBeCloseTo(3 + 15 + 0.3 + 3.75, 10);
  });

  it('una corrida chica cuesta centavos', () => {
    expect(
      costUsd({
        inputTokens: 2000,
        outputTokens: 300,
        cacheReadTokens: 4000,
        cacheWriteTokens: 0,
      }),
    ).toBeCloseTo(0.006 + 0.0045 + 0.0012, 10);
  });

  it('sin tokens no cuesta nada', () => {
    expect(
      costUsd({
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      }),
    ).toBe(0);
  });
});
