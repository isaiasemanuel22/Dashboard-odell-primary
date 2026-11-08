import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  ElementRef,
  TemplateRef,
  computed,
  contentChild,
  contentChildren,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { OrderStatus, QuoteStatus, ServiceType } from '../../core/models';
import {
  AreaServiceType,
  ORDER_STATUS_LABELS,
  QUOTE_STATUS_LABELS,
  SERVICE_TYPE_LABELS,
} from '../../shared/constants/labels';
import { formatDateDayMonth } from '../../shared/utils/date-format.util';
import { DbPillGroupComponent, DbPillOption } from '../db-pill-group/db-pill-group.component';
import { DbAreaChipComponent } from '../db-area-chip/db-area-chip.component';
import {
  DbFilterPanelComponent,
  FilterPanelGroup,
  FilterPanelValues,
} from '../db-filter-panel/db-filter-panel.component';
import { orderIsOverdue } from '../../shared/utils/order.helpers';

export type OdlTone = 'pending' | 'ok' | 'danger' | 'info' | 'neutral';
export type OdlArea = 'impresion3d' | 'diseno' | 'modelado' | 'estampado' | 'general';

export interface OdlTag {
  label: string;
  area: OdlArea;
}

export interface OdlBadge {
  label: string;
  tone: OdlTone;
}

export interface OdlNote {
  text: string;
  tone: 'danger' | 'success' | 'warn' | 'muted';
}

export type OdlColumnType =
  | 'text'
  | 'primary'
  | 'avatar'
  | 'number'
  | 'money'
  | 'signedMoney'
  | 'date'
  | 'tags'
  | 'badge'
  | 'swatch'
  | 'button'
  | 'custom';

export interface OdlColumn<T> {
  key: string;
  header: string;
  type?: OdlColumnType;
  value?: (row: T) => unknown;
  secondary?: (row: T) => string | null | undefined;
  note?: (row: T) => OdlNote | null | undefined;
  tags?: (row: T) => OdlTag[];
  badge?: (row: T) => OdlBadge | null | undefined;
  swatch?: (row: T) => string | null | undefined;
  buttonLabel?: string | ((row: T) => string);
  align?: 'start' | 'center' | 'end';
  width?: string;
  sortable?: boolean;
  sortValue?: (row: T) => string | number | Date | null | undefined;
}

export interface OdlRowAction<T> {
  id: string;
  label: string;
  danger?: boolean;
  hidden?: (row: T) => boolean;
  disabled?: (row: T) => boolean;
}

export interface OdlFilter<T> {
  id: string;
  label: string;
  predicate?: (row: T) => boolean;
}

export interface OdlActionEvent<T> {
  actionId: string;
  row: T;
}

export interface OdlSort {
  key: string;
  dir: 'asc' | 'desc';
}

export interface OdlFilterState {
  filter: string | null;
  area: string | null;
  search: string;
}

export interface OdlRowContext<T> {
  $implicit: T;
  row: T;
  value: unknown;
}

@Directive({ selector: 'ng-template[odlCell]', standalone: true })
export class OdlCellDef<T = any> {
  readonly key = input.required<string>({ alias: 'odlCell' });
  readonly template = inject<TemplateRef<OdlRowContext<T>>>(TemplateRef);

  static ngTemplateContextGuard<T>(_dir: OdlCellDef<T>, ctx: unknown): ctx is OdlRowContext<T> {
    return true;
  }
}

@Directive({ selector: 'ng-template[odlRowDetail]', standalone: true })
export class OdlRowDetailDef<T = any> {
  readonly template = inject<TemplateRef<OdlRowContext<T>>>(TemplateRef);

  static ngTemplateContextGuard<T>(_dir: OdlRowDetailDef<T>, ctx: unknown): ctx is OdlRowContext<T> {
    return true;
  }
}

const SERVICE_AREA: Record<AreaServiceType, OdlArea> = {
  [ServiceType.IMPRESION_3D]: 'impresion3d',
  [ServiceType.DISENO_GRAFICO]: 'diseno',
  [ServiceType.MODELADO]: 'modelado',
  [ServiceType.ESTAMPADO]: 'estampado',
};

export function serviceTag(service: ServiceType): OdlTag {
  if (service === ServiceType.INSUMO) {
    return { label: 'Insumo', area: 'general' };
  }
  if (service === ServiceType.SERVICIO_TERCERO) {
    return { label: 'Servicio', area: 'general' };
  }
  return { label: SERVICE_TYPE_LABELS[service], area: SERVICE_AREA[service] };
}

const ORDER_TONE: Record<OrderStatus, OdlBadge['tone']> = {
  [OrderStatus.PENDIENTE]: 'pending',
  [OrderStatus.EN_PROGRESO]: 'info',
  [OrderStatus.TERMINADO]: 'ok',
  [OrderStatus.PARCIALMENTE_ENTREGADO]: 'info',
  [OrderStatus.ENTREGADO]: 'ok',
  [OrderStatus.CANCELADO]: 'neutral',
};

export function orderStatusBadge(status: OrderStatus): OdlBadge {
  return { label: ORDER_STATUS_LABELS[status], tone: ORDER_TONE[status] };
}

const QUOTE_TONE: Record<QuoteStatus, OdlBadge['tone']> = {
  [QuoteStatus.BORRADOR]: 'neutral',
  [QuoteStatus.ENVIADO]: 'info',
  [QuoteStatus.ACEPTADO]: 'ok',
  [QuoteStatus.RECHAZADO]: 'danger',
  [QuoteStatus.CANCELADO]: 'neutral',
};

export function quoteStatusBadge(status: QuoteStatus): OdlBadge {
  return { label: QUOTE_STATUS_LABELS[status], tone: QUOTE_TONE[status] };
}

export function isOrderOverdue(dueDate: string, status: OrderStatus): boolean {
  return orderIsOverdue(dueDate, status);
}

type Key = string | number;

const MONEY = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
const NUMBER = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });

@Component({
  selector: 'db-data-table',
  standalone: true,
  imports: [NgTemplateOutlet, DbPillGroupComponent, DbAreaChipComponent, DbFilterPanelComponent],
  templateUrl: './db-data-table.component.html',
  styleUrl: './db-data-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'closeMenu()',
    '(document:click)': 'onDocumentClick($event)',
    '(window:scroll)': 'closeMenu()',
    '(window:resize)': 'closeMenu()',
  },
})
export class DbDataTableComponent<T> {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  // ── Datos ─────────────────────────────────────────────
  readonly rows = input<T[]>([]);
  readonly columns = input.required<OdlColumn<T>[]>();
  /** Clave única de cada fila (para trackear, expandir y abrir menús). */
  readonly rowKey = input<(row: T) => Key>((row: any) => row?.id ?? row?.key ?? JSON.stringify(row));
  /** Nombre accesible de la tabla (no se ve). */
  readonly label = input<string>('Tabla');

  // ── Comportamiento ────────────────────────────────────
  readonly actions = input<OdlRowAction<T>[]>([]);
  /** aria-label del botón ··· por fila. */
  readonly actionsAriaLabel = input<(row: T) => string>();
  readonly expandable = input(false);
  readonly clickableRows = input(false);
  readonly loading = input(false);
  /** Ancho mínimo antes de que la tabla haga scroll horizontal. */
  readonly minWidth = input('760px');

  // ── Barra de filtros (opcional) ───────────────────────
  readonly filters = input<OdlFilter<T>[]>([]);
  readonly areaFilters = input<OdlFilter<T>[]>([]);
  readonly areaLabel = input('Área');
  /**
   * Con título, los filtros y el área se agrupan en un panel desplegable
   * (botón «Filtros») en vez de chips sueltos. Solo con `clientSide`.
   */
  readonly filterPanelTitle = input<string | null>(null);
  /** Título del grupo de `filters` dentro del panel. */
  readonly filterGroupLabel = input('Estado');
  readonly panelEntityOne = input('resultado');
  readonly panelEntityMany = input('resultados');
  /** Si es null no se muestra el buscador. */
  readonly searchPlaceholder = input<string | null>(null);
  /** Texto donde busca cada fila. Por defecto, todos los valores de las columnas. */
  readonly searchText = input<((row: T) => string) | null>(null);
  /** true: la tabla filtra, busca y ordena sola. false: solo emite eventos (filtrado en el backend). */
  readonly clientSide = input(true);

  // ── Paginación "Ver más" (opcional) ──────────────────
  readonly pageSize = input<number | null>(null);

  // ── Vacío ─────────────────────────────────────────────
  readonly emptyText = input('No hay registros para mostrar.');
  readonly emptyActionLabel = input<string | null>(null);

  // ── Eventos ───────────────────────────────────────────
  readonly rowClick = output<T>();
  readonly action = output<OdlActionEvent<T>>();
  readonly emptyAction = output<void>();
  readonly filterChange = output<OdlFilterState>();
  readonly sortChange = output<OdlSort | null>();

  // ── Templates de la pantalla ──────────────────────────
  private readonly cellDefs = contentChildren(OdlCellDef);
  readonly detailDef = contentChild(OdlRowDetailDef);

  // ── Estado interno ────────────────────────────────────
  private readonly filterSel = signal<string | null>(null);
  private readonly areaSel = signal<string | null>(null);
  readonly search = signal('');
  readonly sort = signal<OdlSort | null>(null);
  private readonly expandedKeys = signal<ReadonlySet<Key>>(new Set());
  private readonly shown = signal<number | null>(null);
  readonly menu = signal<{ key: Key; row: T; top: number; left: number } | null>(null);

  readonly activeFilter = computed(() => this.filterSel() ?? this.filters()[0]?.id ?? null);
  readonly activeArea = computed(() => this.areaSel() ?? this.areaFilters()[0]?.id ?? null);

  readonly filterOptions = computed<DbPillOption[]>(() =>
    this.filters().map((f) => ({ value: f.id, label: f.label })),
  );
  readonly areaOptions = computed<DbPillOption[]>(() =>
    this.areaFilters().map((a) => ({ value: a.id, label: a.label })),
  );

  readonly usesPanel = computed(
    () => this.filterPanelTitle() !== null && (this.filters().length > 0 || this.areaFilters().length > 0),
  );

  readonly panelGroups = computed<FilterPanelGroup[]>(() => {
    const groups: FilterPanelGroup[] = [];
    if (this.filters().length) {
      groups.push({ id: 'filter', title: this.filterGroupLabel(), options: this.filterOptions() });
    }
    if (this.areaFilters().length) {
      groups.push({ id: 'area', title: this.areaLabel(), options: this.areaOptions() });
    }
    return groups;
  });

  readonly panelValues = computed<FilterPanelValues>(() => ({
    filter: this.activeFilter() ?? '',
    area: this.activeArea() ?? '',
  }));

  /** Cuántas filas darían estos filtros (con la búsqueda actual). */
  readonly panelCount = (draft: FilterPanelValues): number =>
    this.applyFilters(this.rows(), draft['filter'] ?? null, draft['area'] ?? null).length;

  readonly cellTemplates = computed(() => new Map(this.cellDefs().map((d) => [d.key(), d.template])));

  readonly hasToolbar = computed(
    () => this.filters().length > 0 || this.areaFilters().length > 0 || this.searchPlaceholder() !== null,
  );

  readonly colspan = computed(
    () => this.columns().length + (this.expandable() ? 1 : 0) + (this.actions().length ? 1 : 0),
  );

  readonly processed = computed(() => {
    let data = this.rows();
    if (!this.clientSide()) return data;

    data = this.applyFilters(data, this.activeFilter(), this.activeArea());

    const s = this.sort();
    if (s) {
      const col = this.columns().find((c) => c.key === s.key);
      if (col) {
        const get = col.sortValue ?? ((row: T) => this.valueOf(col, row) as any);
        const dir = s.dir === 'asc' ? 1 : -1;
        data = [...data].sort((x, y) => compare(get(x), get(y)) * dir);
      }
    }
    return data;
  });

  private applyFilters(data: T[], filterId: string | null, areaId: string | null): T[] {
    const f = this.filters().find((x) => x.id === filterId);
    if (f?.predicate) data = data.filter(f.predicate);

    const a = this.areaFilters().find((x) => x.id === areaId);
    if (a?.predicate) data = data.filter(a.predicate);

    const q = normalize(this.search().trim());
    if (q) {
      const text = this.searchText() ?? ((row: T) => this.columns().map((c) => this.toText(c, row)).join(' '));
      data = data.filter((row) => normalize(text(row)).includes(q));
    }
    return data;
  }

  applyPanel(values: FilterPanelValues): void {
    if (values['filter']) this.filterSel.set(values['filter']);
    if (values['area']) this.areaSel.set(values['area']);
    this.resetPaging();
    this.emitFilters();
  }

  readonly visibleRows = computed(() => {
    const limit = this.shown() ?? this.pageSize();
    const data = this.processed();
    return limit ? data.slice(0, limit) : data;
  });

  readonly remaining = computed(() => this.processed().length - this.visibleRows().length);

  // ── Filtros y búsqueda ────────────────────────────────
  setFilter(id: string): void {
    this.filterSel.set(id);
    this.resetPaging();
    this.emitFilters();
  }

  setArea(id: string): void {
    this.areaSel.set(id);
    this.resetPaging();
    this.emitFilters();
  }

  onSearch(value: string): void {
    this.search.set(value);
    this.resetPaging();
    this.emitFilters();
  }

  private emitFilters(): void {
    this.filterChange.emit({ filter: this.activeFilter(), area: this.activeArea(), search: this.search() });
  }

  private resetPaging(): void {
    this.shown.set(null);
  }

  showMore(): void {
    const step = this.pageSize() ?? 20;
    this.shown.set(this.visibleRows().length + step);
  }

  // ── Orden ─────────────────────────────────────────────
  toggleSort(col: OdlColumn<T>): void {
    if (!col.sortable) return;
    const cur = this.sort();
    const next: OdlSort | null =
      cur?.key !== col.key ? { key: col.key, dir: 'asc' } : cur.dir === 'asc' ? { key: col.key, dir: 'desc' } : null;
    this.sort.set(next);
    this.sortChange.emit(next);
  }

  ariaSort(col: OdlColumn<T>): string | null {
    if (!col.sortable) return null;
    const s = this.sort();
    if (s?.key !== col.key) return 'none';
    return s.dir === 'asc' ? 'ascending' : 'descending';
  }

  // ── Expandir ──────────────────────────────────────────
  isExpanded(row: T): boolean {
    return this.expandedKeys().has(this.rowKey()(row));
  }

  toggleExpand(row: T, event?: Event): void {
    event?.stopPropagation();
    const key = this.rowKey()(row);
    const next = new Set(this.expandedKeys());
    next.has(key) ? next.delete(key) : next.add(key);
    this.expandedKeys.set(next);
  }

  // ── Click en fila ─────────────────────────────────────
  onRowClick(row: T, event: Event): void {
    if (!this.clickableRows()) return;
    const target = event.target as HTMLElement;
    if (target.closest('button, a, input, select, textarea, label')) return;
    this.rowClick.emit(row);
  }

  // ── Menú ··· ──────────────────────────────────────────
  visibleActions(row: T): OdlRowAction<T>[] {
    return this.actions().filter((a) => !a.hidden?.(row));
  }

  toggleMenu(row: T, event: MouseEvent): void {
    event.stopPropagation();
    const key = this.rowKey()(row);
    if (this.menu()?.key === key) {
      this.closeMenu();
      return;
    }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const menuWidth = 200;
    const left = Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8));
    const estimatedHeight = this.visibleActions(row).length * 40 + 12;
    const below = rect.bottom + 4;
    const top = below + estimatedHeight > window.innerHeight ? Math.max(8, rect.top - estimatedHeight - 4) : below;
    this.menu.set({ key, row, top, left });
    queueMicrotask(() => this.host.nativeElement.querySelector<HTMLElement>('.odl-menu button:not([disabled])')?.focus());
  }

  isMenuOpen(row: T): boolean {
    return this.menu()?.key === this.rowKey()(row);
  }

  runAction(a: OdlRowAction<T>, row: T): void {
    if (a.disabled?.(row)) return;
    this.closeMenu();
    this.action.emit({ actionId: a.id, row });
  }

  runButton(col: OdlColumn<T>, row: T, event: Event): void {
    event.stopPropagation();
    this.action.emit({ actionId: col.key, row });
  }

  closeMenu(): void {
    if (this.menu()) this.menu.set(null);
  }

  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.odl-menu') && !target.closest('.odl-more')) this.closeMenu();
  }

  onMenuKeydown(event: KeyboardEvent): void {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const items = Array.from(
      this.host.nativeElement.querySelectorAll<HTMLButtonElement>('.odl-menu button:not([disabled])'),
    );
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
    items[next]?.focus();
  }

  // ── Render de celdas ──────────────────────────────────
  valueOf(col: OdlColumn<T>, row: T): unknown {
    return col.value ? col.value(row) : (row as any)?.[col.key];
  }

  typeOf(col: OdlColumn<T>): string {
    return this.cellTemplates().has(col.key) ? 'custom' : (col.type ?? 'text');
  }

  alignOf(col: OdlColumn<T>): 'start' | 'center' | 'end' {
    if (col.align) return col.align;
    return ['number', 'money', 'signedMoney'].includes(col.type ?? '') ? 'end' : 'start';
  }

  money(v: unknown): string {
    const n = Number(v ?? 0);
    return (n < 0 ? '-$ ' : '$ ') + MONEY.format(Math.abs(n));
  }

  sign(v: unknown): number {
    return Math.sign(Number(v ?? 0));
  }

  number(v: unknown): string {
    return v === null || v === undefined || v === '' ? '—' : NUMBER.format(Number(v));
  }

  date(v: unknown): string {
    if (!v) return '—';
    return formatDateDayMonth(v instanceof Date ? v : String(v));
  }

  initials(v: unknown): string {
    return String(v ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('');
  }

  buttonText(col: OdlColumn<T>, row: T): string {
    return typeof col.buttonLabel === 'function' ? col.buttonLabel(row) : (col.buttonLabel ?? col.header);
  }

  private toText(col: OdlColumn<T>, row: T): string {
    const parts = [this.valueOf(col, row), col.secondary?.(row), col.badge?.(row)?.label, ...(col.tags?.(row) ?? []).map((t) => t.label)];
    return parts.filter((p) => p !== null && p !== undefined).join(' ');
  }
}

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'es', { numeric: true, sensitivity: 'base' });
}
