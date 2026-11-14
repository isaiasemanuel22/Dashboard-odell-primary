/** Minúsculas, sin tildes ni diacríticos y sin espacios en los bordes. */
export function normalizeSearchText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** true si `haystack` contiene `term` ignorando tildes y mayúsculas. Término vacío = coincide. */
export function matchesSearchText(haystack: unknown, term: unknown): boolean {
  const needle = normalizeSearchText(term);
  if (!needle) return true;
  return normalizeSearchText(haystack).includes(needle);
}

/** Compara textos en orden alfabético es-AR sin distinguir tildes ni mayúsculas. */
export function compareSearchText(a: unknown, b: unknown): number {
  return String(a ?? '').localeCompare(String(b ?? ''), 'es', {
    sensitivity: 'base',
  });
}

/**
 * Ordena alfabéticamente por etiqueta y, si hay etiquetas idénticas,
 * agrega un sufijo que las distinga (categoría o ID corto).
 */
export function sortAndDisambiguateOptions<
  T extends { value: unknown; label: string },
>(
  options: T[],
  suffixOf: (option: T) => string | null | undefined,
): T[] {
  const counts = new Map<string, number>();
  for (const option of options) {
    const key = normalizeSearchText(option.label);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return options
    .map((option) => {
      if ((counts.get(normalizeSearchText(option.label)) ?? 0) < 2) {
        return option;
      }
      const suffix = suffixOf(option)?.trim();
      return suffix ? { ...option, label: `${option.label} (${suffix})` } : option;
    })
    .sort((a, b) => compareSearchText(a.label, b.label));
}

/** Últimos 4 caracteres del ID, para distinguir nombres repetidos. */
export function shortId(id: unknown): string {
  const raw = String(id ?? '');
  return raw ? `#${raw.slice(-4)}` : '';
}
