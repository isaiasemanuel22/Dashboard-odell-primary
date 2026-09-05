import { ServiceType } from '../common/enums';
import { ServiceProfitMargins } from '../common/interfaces';
import { LEGACY_DESIGN_SERVICE } from '../common/service-type.util';

export const DEFAULT_PROFIT_MARGINS: ServiceProfitMargins = {
  impresion_3d: 40,
  diseno_grafico: 50,
  modelado: 50,
  estampado: 35,
};

function readMargin(
  raw: Record<string, unknown>,
  key: keyof ServiceProfitMargins,
): number | undefined {
  const value = raw[key];
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return Math.min(Math.max(parsed, 0), 999);
}

function readLegacyDesignMargin(raw: Record<string, unknown>): number | undefined {
  const value = raw[LEGACY_DESIGN_SERVICE];
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
  const legacyDiseno = readLegacyDesignMargin(source);

  return {
    impresion_3d:
      readMargin(source, ServiceType.IMPRESION_3D) ??
      DEFAULT_PROFIT_MARGINS.impresion_3d,
    diseno_grafico:
      readMargin(source, ServiceType.DISENO_GRAFICO) ??
      legacyDiseno ??
      DEFAULT_PROFIT_MARGINS.diseno_grafico,
    modelado:
      readMargin(source, ServiceType.MODELADO) ??
      legacyDiseno ??
      DEFAULT_PROFIT_MARGINS.modelado,
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
