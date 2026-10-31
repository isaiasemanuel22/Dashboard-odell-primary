import { ResinType } from '../common/enums';
import { ResinTypeConfig } from '../common/interfaces';

/** Catálogo inicial: id estable rt_<code> para migrar precios existentes. */
export const DEFAULT_RESIN_TYPE_CATALOG: ResinTypeConfig[] = [
  { id: 'rt_translucida', name: 'Translúcida' },
  { id: 'rt_dura', name: 'Dura' },
  { id: 'rt_flexible', name: 'Flexible' },
  { id: 'rt_casting', name: 'Casting' },
  { id: 'rt_estandar', name: 'Estándar' },
];

export const RESIN_TYPE_CODE_BY_ID: Record<string, string> = {
  rt_translucida: ResinType.TRANSLUCIDA,
  rt_dura: ResinType.DURA,
  rt_flexible: ResinType.FLEXIBLE,
  rt_casting: ResinType.CASTING,
  rt_estandar: ResinType.ESTANDAR,
};

export function resinTypeCodeFromName(name: string): string {
  const normalized = name.trim().toLowerCase();
  const known = DEFAULT_RESIN_TYPE_CATALOG.find(
    (entry) => entry.name.toLowerCase() === normalized,
  );
  if (known) {
    return RESIN_TYPE_CODE_BY_ID[known.id] ?? normalized;
  }
  return normalized.replace(/\s+/g, '_');
}

export function resinTypeIdForCode(code: string): string | undefined {
  const normalized = code.trim().toLowerCase();
  const match = Object.entries(RESIN_TYPE_CODE_BY_ID).find(
    ([, value]) => value === normalized,
  );
  return match?.[0];
}
