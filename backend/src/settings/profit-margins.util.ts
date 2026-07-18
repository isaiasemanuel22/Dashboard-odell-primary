import { ServiceType } from '../common/enums';
import { ServiceProfitMargins } from '../common/interfaces';

export const DEFAULT_PROFIT_MARGINS: ServiceProfitMargins = {
  impresion_3d: 40,
  diseno: 50,
  estampado: 35,
};

function readMargin(
  raw: Record<string, unknown>,
  service: ServiceType,
): number | undefined {
  const value = raw[service];
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return Math.min(Math.max(parsed, 0), 999);
}

/** Asegura claves de servicio y valores numéricos al cargar o guardar márgenes. */
export function normalizeProfitMargins(raw: unknown): ServiceProfitMargins {
  const source =
    raw && typeof raw === 'object'
      ? (raw as Record<string, unknown>)
      : {};

  return {
    impresion_3d:
      readMargin(source, ServiceType.IMPRESION_3D) ??
      DEFAULT_PROFIT_MARGINS.impresion_3d,
    diseno:
      readMargin(source, ServiceType.DISENO) ??
      DEFAULT_PROFIT_MARGINS.diseno,
    estampado:
      readMargin(source, ServiceType.ESTAMPADO) ??
      DEFAULT_PROFIT_MARGINS.estampado,
  };
}

export function mergeProfitMargins(
  current: unknown,
  patch: unknown,
): ServiceProfitMargins {
  return normalizeProfitMargins({
    ...normalizeProfitMargins(current),
    ...(patch && typeof patch === 'object'
      ? (patch as Record<string, unknown>)
      : {}),
  });
}
