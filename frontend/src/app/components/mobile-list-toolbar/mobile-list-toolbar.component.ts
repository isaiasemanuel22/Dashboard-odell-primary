import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  model,
  output,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface MobileListToolbarChip {
  id: string;
  label: string;
  count?: number;
}

@Component({
  selector: 'db-mobile-list-toolbar',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './mobile-list-toolbar.component.html',
  styleUrl: './mobile-list-toolbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileListToolbarComponent {
  private readonly chipsEl = viewChild<ElementRef<HTMLElement>>('chipsRow');

  /** Texto del buscador (two-way). */
  readonly search = model('');
  /** Chip activo (two-way); `id` del chip. */
  readonly chip = model<string>('');

  readonly placeholder = input('Buscar');
  readonly searchAriaLabel = input<string | undefined>(undefined);
  readonly chipsAriaLabel = input('Filtro rápido');
  /** Si es false, oculta el buscador (p. ej. Cola con lupa en la barra). */
  readonly showSearch = input(true);
  readonly chips = input<MobileListToolbarChip[]>([]);
  /** Muestra el botón de filtros (`m-fbtn`). */
  readonly showFilter = input(false);
  /** Contador de filtros activos (resalta el botón si > 0). */
  readonly filterCount = input(0);
  /** Etiqueta completa del botón (ej. "Filtros · 1" o "Tipo y categoría"). */
  readonly filterLabel = input('Filtros');
  readonly filterAriaLabel = input<string | undefined>(undefined);

  readonly filterClick = output<void>();

  constructor() {
    effect(() => {
      const activeId = this.chip();
      // Dependencia: re-scrollea cuando cambia el chip por código o por toque.
      void activeId;
      void this.visibleChips();
      requestAnimationFrame(() => this.scrollActiveChipIntoView());
    });
  }

  /**
   * Oculta chips con contador 0, salvo «Todos»/«Abiertos» y el activo.
   * Criterio único para todas las listas.
   */
  protected visibleChips(): MobileListToolbarChip[] {
    const activeId = this.chip();
    return this.chips().filter((item) => shouldShowToolbarChip(item, activeId));
  }

  protected onSearchInput(value: string): void {
    this.search.set(value);
  }

  protected clearSearch(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.search.set('');
  }

  protected onChipClick(id: string): void {
    this.chip.set(id);
  }

  protected onFilterClick(): void {
    this.filterClick.emit();
  }

  /**
   * Solo desplaza la fila de chips en horizontal.
   * No usar scrollIntoView: mueve la página y cancela la restauración de scroll.
   */
  private scrollActiveChipIntoView(): void {
    const row = this.chipsEl()?.nativeElement;
    if (!row) return;
    const active = row.querySelector('.m-chip--on') as HTMLElement | null;
    if (!active) return;
    const rowRect = row.getBoundingClientRect();
    const chipRect = active.getBoundingClientRect();
    const pad = 12;
    if (chipRect.left < rowRect.left + pad) {
      row.scrollLeft -= rowRect.left + pad - chipRect.left;
    } else if (chipRect.right > rowRect.right - pad) {
      row.scrollLeft += chipRect.right - (rowRect.right - pad);
    }
  }
}

/** Chips permanentes aunque el contador sea 0. */
const ALWAYS_VISIBLE_CHIP_IDS = new Set(['all', 'todos', 'abiertos']);

export function shouldShowToolbarChip(
  item: MobileListToolbarChip,
  activeId: string,
): boolean {
  if (item.count == null || item.count > 0) return true;
  if (item.id === activeId) return true;
  return ALWAYS_VISIBLE_CHIP_IDS.has(item.id.toLowerCase());
}
