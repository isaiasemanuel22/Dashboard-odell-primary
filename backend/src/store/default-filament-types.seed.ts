import { FilamentType } from '../common/enums';
import { FilamentTypeConfig } from '../common/interfaces';

/** Catálogo inicial: id estable ft_<code> para migrar precios existentes. */
export const DEFAULT_FILAMENT_TYPE_CATALOG: FilamentTypeConfig[] = [
  { id: 'ft_pla', name: 'PLA' },
  { id: 'ft_petg', name: 'PETG' },
  { id: 'ft_tpu', name: 'TPU' },
  { id: 'ft_abs', name: 'ABS' },
  { id: 'ft_asa', name: 'ASA' },
  { id: 'ft_nylon', name: 'Nylon' },
  { id: 'ft_otro', name: 'Otro' },
];

export const FILAMENT_TYPE_CODE_BY_ID: Record<string, string> = {
  ft_pla: FilamentType.PLA,
  ft_petg: FilamentType.PETG,
  ft_tpu: FilamentType.TPU,
  ft_abs: FilamentType.ABS,
  ft_asa: FilamentType.ASA,
  ft_nylon: FilamentType.NYLON,
  ft_otro: FilamentType.OTRO,
};

export function filamentTypeCodeFromName(name: string): string {
  const normalized = name.trim().toLowerCase();
  const known = DEFAULT_FILAMENT_TYPE_CATALOG.find(
    (entry) => entry.name.toLowerCase() === normalized,
  );
  if (known) {
    return FILAMENT_TYPE_CODE_BY_ID[known.id] ?? normalized;
  }
  return normalized;
}

export function filamentTypeIdForCode(code: string): string | undefined {
  const normalized = code.trim().toLowerCase();
  const match = Object.entries(FILAMENT_TYPE_CODE_BY_ID).find(
    ([, value]) => value === normalized,
  );
  return match?.[0];
}
