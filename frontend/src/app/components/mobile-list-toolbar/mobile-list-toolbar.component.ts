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
      void this.chips();
      requestAnimationFrame(() => this.scrollActiveChipIntoView());
    });
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

  private scrollActiveChipIntoView(): void {
    const row = this.chipsEl()?.nativeElement;
    if (!row) return;
    const active = row.querySelector('.m-chip--on') as HTMLElement | null;
    active?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }
}
