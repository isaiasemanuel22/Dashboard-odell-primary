import type {
  EstampadoPrintSpec,
  EstampadoSupplyLine,
} from '../../core/models';
import { isEstampadoPrintValid } from './estampado.helpers';

/** «Falta: a» / «Faltan: a · b» para el resumen junto al botón de guardar. */
export function formatMissingSummary(labels: readonly string[]): string {
  if (!labels.length) return '';
  return `${labels.length === 1 ? 'Falta' : 'Faltan'}: ${labels.join(' · ')}`;
}

/** Texto de un solo faltante o lista, sin prefijo. */
export function joinMissingLabels(labels: readonly string[]): string {
  return labels.join(' · ');
}

/** Precio fijo elegido pero vacío o en 0. */
export function fixedPriceMissingLabels(
  fixedMode: boolean,
  price: number | null | undefined,
): string[] {
  return fixedMode && !(Number(price) > 0) ? ['precio fijo'] : [];
}

/** Estampado: impresos sin medida e insumos sin insumo elegido. */
export function estampadoMissingLabels(
  prints: readonly EstampadoPrintSpec[] | null | undefined,
  supplyLines: readonly EstampadoSupplyLine[] | null | undefined,
): string[] {
  const missing: string[] = [];
  if ((prints ?? []).some((print) => !isEstampadoPrintValid(print))) {
    missing.push('medida del impreso');
  }
  if ((supplyLines ?? []).some((line) => !String(line.supplyId ?? '').trim())) {
    missing.push('insumo');
  }
  return missing;
}

export interface ScrollToFieldOptions {
  /** Resalta un momento (útil cuando no se puede marcar el campo). */
  highlight?: boolean;
  /** Elemento a resaltar; por defecto el mismo al que se hace scroll. */
  highlightEl?: HTMLElement | null;
}

function isEmptyControl(el: HTMLElement): boolean {
  const value = (el as HTMLInputElement | HTMLSelectElement).value;
  if (value == null) return false;
  const text = String(value).trim();
  return text === '' || (el.tagName === 'INPUT' && Number(text) === 0);
}

/**
 * Busca dentro de `scope` el control que corresponde a un faltante: el primero
 * de `selectors` que esté vacío (o en 0); si todos tienen valor, el primero.
 */
export function pickMissingControl(
  scope: ParentNode,
  selectors: string,
  labelText?: string,
): HTMLElement | null {
  const all = Array.from(scope.querySelectorAll<HTMLElement>(selectors));
  if (labelText) {
    // Vista de tarjetas (mobile): el campo se identifica por su etiqueta.
    for (const label of Array.from(scope.querySelectorAll('label'))) {
      if (label.textContent?.replace('*', '').trim() !== labelText) continue;
      const id = label.getAttribute('for');
      const control = id
        ? scope.querySelector<HTMLElement>(`#${CSS.escape(id)}`)
        : null;
      if (control && !all.includes(control)) all.push(control);
    }
  }
  return all.find(isEmptyControl) ?? all[0] ?? null;
}

const FOCUSABLE =
  'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]):not([type="button"]), [tabindex]:not([tabindex="-1"])';

/**
 * Lleva la vista al campo y lo enfoca. `target` es un elemento o un selector
 * buscado dentro de `root`. Devuelve false si no lo encontró.
 */
export function scrollToField(
  root: ParentNode,
  target: string | HTMLElement | null,
  options: ScrollToFieldOptions = {},
): boolean {
  const el =
    typeof target === 'string'
      ? root.querySelector<HTMLElement>(target)
      : target;
  if (!el) return false;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const focusable = el.matches(FOCUSABLE)
    ? el
    : el.querySelector<HTMLElement>(FOCUSABLE);
  focusable?.focus({ preventScroll: true });
  if (options.highlight) {
    const mark = options.highlightEl ?? el;
    const previous = mark.style.boxShadow;
    mark.style.transition = 'box-shadow 0.3s';
    mark.style.boxShadow = '0 0 0 2px #c0392b';
    setTimeout(() => {
      mark.style.boxShadow = previous;
    }, 2200);
  }
  return true;
}
