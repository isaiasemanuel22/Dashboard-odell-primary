/** Precio de Sonnet en USD por millón de tokens. */
export const SONNET_USD_PER_MTOK = {
  input: 3,
  output: 15,
  cacheWrite: 3.75,
  cacheRead: 0.3,
};

export interface AttendantUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

/** Costo en USD de una corrida; los tokens de caché se cobran aparte del input. */
export function costUsd(usage: AttendantUsage): number {
  return (
    (usage.inputTokens * SONNET_USD_PER_MTOK.input +
      usage.outputTokens * SONNET_USD_PER_MTOK.output +
      usage.cacheWriteTokens * SONNET_USD_PER_MTOK.cacheWrite +
      usage.cacheReadTokens * SONNET_USD_PER_MTOK.cacheRead) /
    1_000_000
  );
}
