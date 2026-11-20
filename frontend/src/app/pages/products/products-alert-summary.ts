export interface BelowCalculatedSummary {
  total: number;
  recalculable: number;
  fixed: number;
  title: string;
  recalculableText: string | null;
  fixedText: string | null;
}

/** Aviso único de «debajo del calculado»: el total coincide con el chip. */
export function buildBelowCalculatedSummary(
  recalculable: number,
  fixed: number,
): BelowCalculatedSummary {
  const total = recalculable + fixed;
  return {
    total,
    recalculable,
    fixed,
    title:
      total === 1
        ? '1 producto debajo del precio calculado'
        : `${total} productos debajo del precio calculado`,
    recalculableText:
      recalculable > 0
        ? recalculable === 1
          ? '1 se puede recalcular'
          : `${recalculable} se pueden recalcular`
        : null,
    fixedText:
      fixed > 0
        ? fixed === 1
          ? '1 tiene precio fijo'
          : `${fixed} tienen precio fijo`
        : null,
  };
}
