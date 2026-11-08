import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import { DbButtonComponent } from '../db-button';

export interface FilterPanelOption {
  value: string;
  label: string;
}

export interface FilterPanelGroup {
  id: string;
  title: string;
  options: FilterPanelOption[];
}

/** Valor elegido por grupo (selección única), indexado por `FilterPanelGroup.id`. */
export type FilterPanelValues = Record<string, string>;

let nextId = 0;

/**
 * Panel de filtros de desktop (RdPatrones §3): botón «Filtros» con contador y
 * panel de 360 px anclado debajo. Trabaja sobre un borrador y recién emite al
 * apretar el botón principal; Escape, clic afuera y Cancelar descartan.
 */
@Component({
  selector: 'db-filter-panel',
  standalone: true,
  imports: [CdkConnectedOverlay, CdkOverlayOrigin, CdkTrapFocus, DbButtonComponent],
  templateUrl: './db-filter-panel.component.html',
  styleUrl: './db-filter-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DbFilterPanelComponent {
  /** Encabezado del panel, p. ej. «Filtrar pedidos». */
  readonly title = input.required<string>();
  readonly groups = input.required<FilterPanelGroup[]>();
  /**
   * Grupos según el borrador, para opciones que dependen de otro grupo
   * (p. ej. categorías de un tipo). Si el valor elegido deja de existir,
   * vuelve al «sin filtrar».
   */
  readonly groupsFor = input<((draft: FilterPanelValues) => FilterPanelGroup[]) | null>(null);
  /** Valores aplicados hoy. */
  readonly values = input.required<FilterPanelValues>();
  /** Valor «sin filtrar» de cada grupo. Por defecto, la primera opción. */
  readonly defaults = input<FilterPanelValues | null>(null);
  /** Cuántos resultados daría un borrador. Sin esto el botón dice «Aplicar». */
  readonly countFn = input<((draft: FilterPanelValues) => number) | null>(null);
  readonly entityOne = input('resultado');
  readonly entityMany = input('resultados');
  readonly ariaLabel = input('Filtros');

  readonly apply = output<FilterPanelValues>();

  protected readonly uid = `db-fp-${nextId++}`;
  protected readonly open = signal(false);
  protected readonly draft = signal<FilterPanelValues>({});

  protected readonly shownGroups = computed(() => {
    const fn = this.groupsFor();
    return fn ? fn(this.draft()) : this.groups();
  });

  protected readonly positions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 8 },
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 8 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -8 },
  ];

  private readonly baseline = computed<FilterPanelValues>(() => {
    const explicit = this.defaults();
    const result: FilterPanelValues = {};
    for (const group of this.groups()) {
      result[group.id] = explicit?.[group.id] ?? group.options[0]?.value ?? '';
    }
    return result;
  });

  /** Filtros activos: grupos que difieren de su valor «sin filtrar». */
  readonly activeCount = computed(() => {
    const base = this.baseline();
    const current = this.values();
    return this.groups().filter((g) => (current[g.id] ?? base[g.id]) !== base[g.id]).length;
  });

  protected readonly applyLabel = computed(() => {
    const fn = this.countFn();
    if (!fn) return 'Aplicar';
    const n = fn(this.draft());
    return `Ver ${n} ${n === 1 ? this.entityOne() : this.entityMany()}`;
  });

  protected toggle(): void {
    if (this.open()) {
      this.close();
      return;
    }
    const base = this.baseline();
    const current = this.values();
    const draft: FilterPanelValues = {};
    for (const group of this.groups()) {
      draft[group.id] = current[group.id] ?? base[group.id];
    }
    this.draft.set(draft);
    this.open.set(true);
  }

  protected close(): void {
    this.open.set(false);
  }

  protected select(groupId: string, value: string): void {
    this.draft.update((d) => ({ ...d, [groupId]: value }));
    const fn = this.groupsFor();
    if (!fn) return;
    const base = this.baseline();
    const next = { ...this.draft() };
    for (const group of fn(next)) {
      if (!group.options.some((o) => o.value === next[group.id])) {
        next[group.id] = base[group.id];
      }
    }
    this.draft.set(next);
  }

  protected clear(): void {
    this.draft.set({ ...this.baseline() });
  }

  protected submit(): void {
    this.apply.emit({ ...this.draft() });
    this.close();
  }

  protected onOutside(event: MouseEvent, trigger: HTMLElement): void {
    if (trigger.contains(event.target as Node)) return;
    this.close();
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
    }
  }
}
