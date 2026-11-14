import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  ColorConfig,
  MachineProfile,
  MachineProfileRole,
  ReorderCounts,
  ReorderRow,
  ResinType,
  Spool,
  SpoolAlert,
  SpoolLocation,
  Supplier,
  Supply,
  SupplyCategory,
} from '../../core/models';
import {
  MOBILE_LIST_KEYS,
  injectMobileListPersistence,
} from '../../core/services/mobile-list-state.service';
import { RealtimeService } from '../../core/services/realtime.service';
import { SpoolsService } from '../../core/services/spools.service';
import { SuppliersService } from '../../core/services/suppliers.service';
import {
  SettingsService,
  SuppliesService,
} from '../../core/services/settings.service';
import {
  DbButtonComponent,
  DbInputComponent,
  DbPillGroupComponent,
  DbSelectComponent,
  DbSelectOption,
  DbSkeletonComponent,
  DbStateMessageComponent,
  DB_DATA_TABLE,
  MobileBarComponent,
  MobileListToolbarComponent,
  MobileSheetComponent,
  SuppliesTableComponent,
  type MobileListToolbarChip,
  type OdlActionEvent,
  type OdlColumn,
  type OdlRowAction,
  type DbPillOption,
} from '@general-components';
import {
  FILAMENT_TYPE_LABELS,
  RESIN_TYPE_LABELS,
  SUPPLY_CATEGORY_LABELS,
} from '../../shared/constants/labels';
import { FormDialogService } from '../../modals/public-api';
import { FormModalComponent } from '../../modals/form-modal/form-modal.component';
import { extractApiErrorMessage } from '../../shared/utils/api-error';
import { resolveColorLabel } from '../../shared/utils/color.helpers';
import { supplyCategoryFilters } from '../../shared/utils/list-filters';
import {
  abbreviateSupplyUnit,
  formatLeadTimeBusinessDays,
  formatSupplyGrams,
  formatSupplyQuantity,
} from '../../shared/utils/supply-unit.util';
import { formatOpenedAgo } from '../../shared/utils/relative-day.util';
import { formatYmdWeekdayDdMm } from '../print-jobs/printer-queue-format.util';
import { CurrencyArsPipe } from '../../shared/pipes/labels.pipe';
import { SuppliesFacade } from '../../store/supplies/supplies.facade';
import {
  SuppliesPageTab,
  formatCoversDays,
  parseSuppliesTab,
  readStoredSuppliesTab,
  storeSuppliesTab,
  supplyQuantityToGrams,
} from './supplies-tab.util';
import {
  normalizeSearchText,
  shortId,
  sortAndDisambiguateOptions,
} from '../../shared/utils/search-text.util';

type CategoryFilter = SupplyCategory | 'all';
type StockFilter = 'all' | 'ok' | 'low';
type MobileChip = 'all' | 'low' | SupplyCategory;
type LocationKind = 'printer' | 'shelf';

interface SuppliesMobileListState {
  search: string;
  categoryFilter: CategoryFilter;
  stockFilter: StockFilter;
  scrollY: number;
}

interface SpoolRowView {
  spool: Spool;
  supply: Supply | null;
  supplierName: string;
  colorHex: string | null;
  filamentLabel: string;
  locationLabel: string;
  openedLabel: string;
  remainingAmountLabel: string;
  remainingOfLabel: string;
  remainingLabel: string;
  remainingPct: number;
  remainingDanger: boolean;
}

@Component({
  selector: 'app-supplies',
  standalone: true,
  imports: [
    FormsModule,
    DbStateMessageComponent,
    DbButtonComponent,
    DbPillGroupComponent,
    DbSkeletonComponent,
    DbSelectComponent,
    DbInputComponent,
    MobileBarComponent,
    MobileListToolbarComponent,
    MobileSheetComponent,
    SuppliesTableComponent,
    FormModalComponent,
    ...DB_DATA_TABLE,
  ],
  templateUrl: './supplies.component.html',
  styleUrl: './supplies.component.scss',
})
export class SuppliesComponent implements OnInit {
  private readonly suppliesService = inject(SuppliesService);
  private readonly suppliesFacade = inject(SuppliesFacade);
  private readonly settingsService = inject(SettingsService);
  private readonly spoolsService = inject(SpoolsService);
  private readonly suppliersService = inject(SuppliersService);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly formDialogs = inject(FormDialogService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly currency = new CurrencyArsPipe();
  private readonly listPersistence =
    injectMobileListPersistence<SuppliesMobileListState>(
      MOBILE_LIST_KEYS.supplies,
    );

  supplies: Supply[] = [];
  colorCatalog: ColorConfig[] = [];
  printers: MachineProfile[] = [];
  suppliers: Supplier[] = [];
  spools: Spool[] = [];
  reorderRows: ReorderRow[] = [];
  reorderCounts: ReorderCounts = { openSpools: 0, urgentCount: 0, total: 0 };
  spoolAlerts: SpoolAlert[] = [];
  loading = true;
  search = '';
  categoryFilter: CategoryFilter = 'all';
  stockFilter: StockFilter = 'all';
  activeTab: SuppliesPageTab = 'insumos';
  statusNotice = '';

  readonly tabOptions: { value: SuppliesPageTab; label: string }[] = [
    { value: 'insumos', label: 'Insumos' },
    { value: 'bobinas', label: 'Bobinas abiertas' },
    { value: 'reposicion', label: 'Reposición' },
  ];

  readonly stockFilters: DbPillOption<StockFilter>[] = [
    { value: 'all', label: 'Todos' },
    { value: 'ok', label: 'Stock OK' },
    { value: 'low', label: 'Stock bajo' },
  ];

  readonly spoolActions: OdlRowAction<SpoolRowView>[] = [
    { id: 'mover', label: 'Mover…' },
    { id: 'ajustar', label: 'Ajustar peso…' },
    { id: 'terminar', label: 'Terminar bobina', danger: true },
  ];

  readonly spoolColumns: OdlColumn<SpoolRowView>[] = [
    {
      key: 'code',
      header: 'Bobina',
      type: 'primary',
      value: (row) => row.spool.code,
    },
    { key: 'filament', header: 'Filamento' },
    { key: 'remaining', header: 'Restante' },
    {
      key: 'where',
      header: 'Dónde está',
      value: (row) => row.locationLabel,
    },
    {
      key: 'opened',
      header: 'Abierta',
      value: (row) => row.openedLabel,
    },
  ];

  readonly reorderColumns: OdlColumn<ReorderRow>[] = [
    { key: 'name', header: 'Insumo', type: 'primary' },
    {
      key: 'stock',
      header: 'Stock',
      align: 'end',
      value: (row) => formatSupplyQuantity(row.stock, row.unit),
    },
    {
      key: 'weekly',
      header: 'Consumo semanal',
      align: 'end',
      value: (row) =>
        row.insufficientData
          ? 'Sin datos suficientes'
          : formatSupplyQuantity(row.weeklyConsumption, row.unit),
    },
    {
      key: 'covers',
      header: 'Alcanza para',
      align: 'end',
    },
    {
      key: 'supplier',
      header: 'Proveedor · demora',
      value: (row) =>
        row.supplier
          ? `${row.supplier.name} · ${formatLeadTimeBusinessDays(row.supplier.leadTimeBusinessDays)}`
          : 'Sin proveedor',
    },
    { key: 'orderBy', header: 'Pedir antes del' },
  ];

  readonly spoolActionsAriaLabel = (row: SpoolRowView): string =>
    `Acciones de la bobina ${row.spool.code}`;

  // Dialogs / sheets
  spoolDialog: null | 'open' | 'move' | 'adjust' | 'order' = null;
  spoolDialogBusy = false;
  spoolDialogError = '';
  selectedSpool: Spool | null = null;
  openSupplyId = '';
  openGrams = 1000;
  locationKind: LocationKind = 'printer';
  locationPrinterId = '';
  locationSlot = 1;
  locationShelf = '';
  adjustGrams = 0;
  orderSupplierId = '';
  orderDraftText = '';
  orderDraftHasLines = false;
  orderCopyNotice = '';
  private orderCopyTimer: ReturnType<typeof setTimeout> | null = null;
  private statusNoticeTimer: ReturnType<typeof setTimeout> | null = null;
  mobileSpoolActions: SpoolRowView | null = null;
  alertsExpanded = false;

  get categoryFilters() {
    return supplyCategoryFilters().map((filter) =>
      filter.value === 'all' ? { ...filter, label: 'Todas' } : filter,
    );
  }

  private get mobileCountBase(): Supply[] {
    const term = normalizeSearchText(this.search);
    if (!term) return this.supplies;
    return this.supplies.filter((s) => this.supplySearchText(s).includes(term));
  }

  get mobileToolbarChips(): MobileListToolbarChip[] {
    const base = this.mobileCountBase;
    const categories = (
      Object.keys(SUPPLY_CATEGORY_LABELS) as SupplyCategory[]
    ).map((value) => ({
      id: value,
      label: SUPPLY_CATEGORY_LABELS[value],
      count: base.filter((s) => s.category === value).length,
    }));
    return [
      { id: 'all', label: 'Todos', count: base.length },
      {
        id: 'low',
        label: 'Stock bajo',
        count: base.filter((s) => s.quantity <= s.minStock).length,
      },
      ...categories,
    ];
  }

  get mobileChip(): MobileChip {
    if (this.stockFilter === 'low' && this.categoryFilter === 'all') {
      return 'low';
    }
    if (this.categoryFilter !== 'all' && this.stockFilter === 'all') {
      return this.categoryFilter;
    }
    if (this.stockFilter === 'all' && this.categoryFilter === 'all') {
      return 'all';
    }
    return this.categoryFilter !== 'all' ? this.categoryFilter : 'all';
  }

  get lowStockCount(): number {
    return this.supplies.filter((supply) => supply.quantity <= supply.minStock)
      .length;
  }

  get headerSubtitle(): string {
    const open = this.reorderCounts.openSpools;
    const urgent = this.reorderCounts.urgentCount;
    const openLabel =
      open === 1 ? '1 bobina abierta' : `${open} bobinas abiertas`;
    const urgentLabel =
      urgent === 1 ? '1 insumo para reponer' : `${urgent} para reponer`;
    return `Filamentos, resinas, tintas y textiles · ${openLabel} · ${urgentLabel}`;
  }

  get urgentReorderAlerts(): Extract<SpoolAlert, { kind: 'reorder' }>[] {
    return this.spoolAlerts.filter(
      (a): a is Extract<SpoolAlert, { kind: 'reorder' }> => a.kind === 'reorder',
    );
  }

  get visibleReorderAlerts(): Extract<SpoolAlert, { kind: 'reorder' }>[] {
    const all = this.urgentReorderAlerts;
    if (this.alertsExpanded || all.length <= 2) return all;
    return all.slice(0, 2);
  }

  get hiddenReorderAlertCount(): number {
    return Math.max(0, this.urgentReorderAlerts.length - 2);
  }

  get spoolShortAlerts(): Extract<SpoolAlert, { kind: 'spool_short' }>[] {
    return this.spoolAlerts.filter(
      (a): a is Extract<SpoolAlert, { kind: 'spool_short' }> =>
        a.kind === 'spool_short',
    );
  }

  get spoolRows(): SpoolRowView[] {
    const supplyById = new Map(this.supplies.map((s) => [s.id, s]));
    const supplierById = new Map(this.suppliers.map((s) => [s.id, s]));
    const printerById = new Map(this.printers.map((p) => [p.id, p]));
    return this.spools
      .filter((s) => !s.finishedAt)
      .map((spool) => {
        const supply = supplyById.get(spool.supplyId) ?? null;
        const supplierName =
          (supply?.supplierId
            ? supplierById.get(supply.supplierId)?.name
            : undefined) ||
          supply?.supplier ||
          '';
        const colorHex = supply?.colorId
          ? (this.colorCatalog.find((c) => c.id === supply.colorId)?.hex ?? null)
          : null;
        const filamentLabel = supply
          ? `${supply.name}${supplierName ? ` · ${supplierName}` : ''}`
          : 'Insumo desconocido';
        const remainingPct =
          spool.initialGrams > 0
            ? Math.round((spool.remainingGrams / spool.initialGrams) * 100)
            : 0;
        const remainingDanger =
          remainingPct < 20 || (Number(spool.remainingGrams) < 150 && remainingPct < 50);
        const remainingAmountLabel = formatSupplyGrams(spool.remainingGrams);
        const remainingOfLabel = `de ${formatSupplyGrams(spool.initialGrams)}`;
        return {
          spool,
          supply,
          supplierName,
          colorHex,
          filamentLabel,
          locationLabel: this.formatSpoolLocation(spool, printerById),
          openedLabel: formatOpenedAgo(spool.openedAt),
          remainingAmountLabel,
          remainingOfLabel,
          remainingLabel: `${remainingAmountLabel} ${remainingOfLabel}`,
          remainingPct: Math.max(0, Math.min(100, remainingPct)),
          remainingDanger,
        };
      })
      .sort((a, b) => a.spool.code.localeCompare(b.spool.code, 'es'));
  }

  get filamentSupplyOptions(): DbSelectOption[] {
    return sortAndDisambiguateOptions(
      this.supplies
        .filter((s) => s.category === SupplyCategory.FDM)
        .filter((s) => this.closedGrams(s) > 1)
        .map((s) => ({
          value: s.id,
          label: s.name,
        })),
      (o) => shortId(o.value),
    );
  }

  get openSupplyHint(): string {
    const supply = this.supplies.find((s) => s.id === this.openSupplyId);
    if (!supply) return '';
    const closedQty = this.gramsToSupplyQuantity(supply, this.closedGrams(supply));
    const closedLabel = formatSupplyQuantity(closedQty, supply.unit);
    const openLabel = formatSupplyGrams(this.openRemainingGrams(supply.id));
    return `cerrado ${closedLabel} · en bobinas abiertas: ${openLabel}`;
  }

  get spoolDialogTitle(): string {
    if (this.spoolDialog === 'open') return 'Abrir bobina';
    if (this.spoolDialog === 'move') {
      return this.selectedSpool
        ? `Mover bobina ${this.selectedSpool.code}`
        : 'Mover bobina';
    }
    if (this.spoolDialog === 'adjust') {
      return this.selectedSpool
        ? `Ajustar peso de ${this.selectedSpool.code}`
        : 'Ajustar peso';
    }
    if (this.spoolDialog === 'order') return 'Armar pedido al proveedor';
    return '';
  }

  get spoolDialogSubtitle(): string {
    if (this.spoolDialog !== 'move' && this.spoolDialog !== 'adjust') {
      return '';
    }
    const supplyId = this.selectedSpool?.supplyId;
    if (!supplyId) return '';
    return this.supplies.find((s) => s.id === supplyId)?.name ?? '';
  }

  coversLabel(row: ReorderRow): string {
    return row.insufficientData
      ? 'Sin datos suficientes'
      : formatCoversDays(row.coversDays);
  }

  formatSupplierLead(row: ReorderRow): string {
    if (!row.supplier) return '';
    return `${row.supplier.name} · ${formatLeadTimeBusinessDays(row.supplier.leadTimeBusinessDays)}`;
  }

  get printerOptions(): DbSelectOption[] {
    return this.printers.map((p) => ({ value: p.id, label: p.name }));
  }

  get slotOptions(): DbSelectOption[] {
    const occupied = this.occupiedSlots(this.locationPrinterId, this.selectedSpool?.id);
    return [1, 2, 3, 4].map((slot) => ({
      value: String(slot),
      label: occupied.has(slot)
        ? `Ranura ${slot} (ocupada)`
        : `Ranura ${slot}`,
    }));
  }

  get orderSupplierOptions(): DbSelectOption[] {
    const withSuggestions = new Set(
      this.reorderRows
        .filter((r) => r.supplier && r.suggestedQuantity > 0)
        .map((r) => r.supplier!.id),
    );
    const preferred = this.suppliers.filter((s) => withSuggestions.has(s.id));
    const rest = this.suppliers.filter((s) => !withSuggestions.has(s.id));
    const toOptions = (list: Supplier[]) =>
      list.map((s) => ({ value: s.id, label: s.name }));
    const all = sortAndDisambiguateOptions(
      toOptions([...preferred, ...rest]),
      (o) => shortId(o.value),
    );
    const preferredIds = new Set(preferred.map((s) => s.id));
    return [
      ...all.filter((o) => preferredIds.has(o.value as string)),
      ...all.filter((o) => !preferredIds.has(o.value as string)),
    ];
  }

  get hasListFilters(): boolean {
    return (
      this.search.trim().length > 0 ||
      this.categoryFilter !== 'all' ||
      this.stockFilter !== 'all'
    );
  }

  get emptyMessage(): string {
    if (this.supplies.length > 0 && this.hasListFilters) {
      return 'No hay insumos que coincidan con la búsqueda o el filtro.';
    }
    return 'No hay insumos para mostrar.';
  }

  get filteredSupplies(): Supply[] {
    const term = normalizeSearchText(this.search);
    return this.supplies.filter((s) => {
      const matchesSearch = !term || this.supplySearchText(s).includes(term);
      const matchesCategory =
        this.categoryFilter === 'all' || s.category === this.categoryFilter;
      const low = s.quantity <= s.minStock;
      const matchesStock =
        this.stockFilter === 'all' ||
        (this.stockFilter === 'low' && low) ||
        (this.stockFilter === 'ok' && !low);
      return matchesSearch && matchesCategory && matchesStock;
    });
  }

  get mobileFilteredSupplies(): Supply[] {
    return this.filteredSupplies.slice().sort((a, b) => {
      const aLow = a.quantity <= a.minStock || a.quantity <= 0 ? 0 : 1;
      const bLow = b.quantity <= b.minStock || b.quantity <= 0 ? 0 : 1;
      return aLow - bLow;
    });
  }

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => this.clearStatusNotice());

    this.listPersistence.connect(() => ({
      search: this.search,
      categoryFilter: this.categoryFilter,
      stockFilter: this.stockFilter,
    }));

    const filtro = this.route.snapshot.queryParamMap.get('filtro');
    const stock = this.route.snapshot.queryParamMap.get('stock');
    const queryApplied = filtro === 'stock_bajo' || stock === 'low';
    if (queryApplied) {
      this.stockFilter = 'low';
    } else {
      this.listPersistence.restore((saved) => {
        this.search = saved.search;
        this.categoryFilter = saved.categoryFilter;
        this.stockFilter = saved.stockFilter;
      });
    }

    const tabParam = parseSuppliesTab(
      this.route.snapshot.queryParamMap.get('tab'),
    );
    this.activeTab = tabParam ?? readStoredSuppliesTab() ?? 'insumos';

    this.loadColorCatalog();
    this.loadAuxData();

    this.suppliesFacade.loading$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((loading) => {
        this.loading = loading;
        if (!loading) {
          this.listPersistence.onListReady();
        }
      });

    this.suppliesService
      .watchSupplies()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((items) => {
        this.supplies = items;
      });

    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const tab = parseSuppliesTab(params.get('tab'));
        if (tab && tab !== this.activeTab) {
          this.activeTab = tab;
          storeSuppliesTab(tab);
        }
      });

    this.realtime.bindSmartReload(
      this.destroyRef,
      ['supplies', 'print-jobs', 'settings'],
      () => this.refreshSuppliesAndAux(),
    );
  }

  setTab(tab: SuppliesPageTab): void {
    this.activeTab = tab;
    storeSuppliesTab(tab);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab === 'insumos' ? null : tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  onMobileChipChange(chipId: string): void {
    this.setMobileChip(chipId as MobileChip);
  }

  setMobileChip(chip: MobileChip): void {
    if (chip === 'all') {
      this.stockFilter = 'all';
      this.categoryFilter = 'all';
      return;
    }
    if (chip === 'low') {
      this.stockFilter = 'low';
      this.categoryFilter = 'all';
      return;
    }
    this.stockFilter = 'all';
    this.categoryFilter = chip;
  }

  isLowStock(supply: Supply): boolean {
    return supply.quantity <= supply.minStock;
  }

  formatQuantity(supply: Supply): string {
    return formatSupplyQuantity(supply.quantity, supply.unit);
  }

  formatQty(quantity: number, unit: string): string {
    return formatSupplyQuantity(quantity, unit);
  }

  mobileRowMeta(supply: Supply): string {
    const category = SUPPLY_CATEGORY_LABELS[supply.category] ?? supply.category;
    const unit = abbreviateSupplyUnit(supply.unit);
    if (this.isLowStock(supply)) {
      const min = Number(supply.minStock) || 0;
      const minLabel = Number.isInteger(min)
        ? String(min)
        : min.toLocaleString('es-AR', { maximumFractionDigits: 2 });
      return `${category} · mínimo ${minLabel} ${unit}`;
    }
    if (supply.unitPrice > 0) {
      const price = `${this.currency.transform(supply.unitPrice)}/${unit}`;
      const source = supply.priceFromSettings
        ? 'precio del insumo · lista Ajustes'
        : 'precio del insumo';
      return `${category} · ${price} · ${source}`;
    }
    return category;
  }

  stockLevelPercent(supply: Supply): number {
    if (supply.quantity <= 0) return 0;
    const target = Math.max(Number(supply.minStock) * 2, 1);
    return Math.min(100, Math.round((supply.quantity / target) * 100));
  }

  stockLevelColor(supply: Supply): string {
    return this.isLowStock(supply) ? '#B91C1C' : '#15803D';
  }

  openPurchase(): void {
    void this.router.navigate(['/billetera'], { queryParams: { compra: '1' } });
  }

  openCreate(): void {
    this.clearStatusNotice();
    const defaultCategory =
      this.categoryFilter === 'all' ? undefined : this.categoryFilter;
    this.formDialogs.openSupply(null, defaultCategory).subscribe();
  }

  openEdit(supply: Supply): void {
    this.clearStatusNotice();
    this.formDialogs.openSupply(supply).subscribe();
  }

  deleteSupply(supply: Supply): void {
    this.formDialogs
      .openConfirm({
        title: 'Eliminar insumo',
        message: `¿Eliminar "${supply.name}"?`,
        confirmLabel: 'Eliminar',
        confirmVariant: 'delete',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.suppliesService.deleteSupply(supply.id).subscribe({
          error: (err) => {
            this.formDialogs
              .openConfirm({
                title: 'No se pudo eliminar',
                message: extractApiErrorMessage(
                  err,
                  'No se pudo eliminar el insumo',
                ),
                confirmLabel: 'Entendido',
                alertOnly: true,
              })
              .subscribe();
          },
        });
      });
  }

  onSpoolAction(event: OdlActionEvent<SpoolRowView>): void {
    if (event.actionId === 'mover') this.openMoveDialog(event.row.spool);
    if (event.actionId === 'ajustar') this.openAdjustDialog(event.row.spool);
    if (event.actionId === 'terminar') this.finishSpool(event.row.spool);
  }

  openOpenSpoolDialog(): void {
    this.clearStatusNotice();
    this.selectedSpool = null;
    this.openSupplyId = this.filamentSupplyOptions[0]?.value ?? '';
    this.openGrams = this.defaultGramsForSupply(this.openSupplyId);
    this.locationKind = 'printer';
    this.locationPrinterId = this.printers[0]?.id ?? '';
    this.locationSlot = 1;
    this.locationShelf = '';
    this.spoolDialogError = '';
    this.spoolDialog = 'open';
  }

  onOpenSupplyChange(supplyId: string): void {
    this.openSupplyId = supplyId;
    this.openGrams = this.defaultGramsForSupply(supplyId);
  }

  openMoveDialog(spool: Spool): void {
    this.clearStatusNotice();
    this.selectedSpool = spool;
    this.locationKind = spool.location.kind;
    if (spool.location.kind === 'printer') {
      this.locationPrinterId = spool.location.printerId;
      this.locationSlot = spool.location.slot;
      this.locationShelf = '';
    } else {
      this.locationPrinterId = this.printers[0]?.id ?? '';
      this.locationSlot = 1;
      this.locationShelf = spool.location.text;
    }
    this.spoolDialogError = '';
    this.spoolDialog = 'move';
    this.mobileSpoolActions = null;
  }

  openAdjustDialog(spool: Spool): void {
    this.clearStatusNotice();
    this.selectedSpool = spool;
    this.adjustGrams = Math.round(Number(spool.remainingGrams) || 0);
    this.spoolDialogError = '';
    this.spoolDialog = 'adjust';
    this.mobileSpoolActions = null;
  }

  finishSpool(spool: Spool): void {
    this.clearStatusNotice();
    this.mobileSpoolActions = null;
    const rem = Math.round(Number(spool.remainingGrams) || 0);
    this.formDialogs
      .openConfirm({
        title: 'Terminar bobina',
        message: `Se descarta el remanente de ${rem} g`,
        confirmLabel: 'Terminar',
        confirmVariant: 'delete',
      })
      .subscribe((ok) => {
        if (!ok) return;
        this.spoolsService.finish(spool.id).subscribe({
          next: (finished) => {
            this.upsertSpoolLocal(finished);
            this.flashStatusNotice(`Bobina ${spool.code} terminada`);
            this.refreshSuppliesAndAux();
          },
          error: (err) => this.toastError(err, 'No se pudo terminar la bobina'),
        });
      });
  }

  closeSpoolDialog(): void {
    this.spoolDialog = null;
    this.spoolDialogBusy = false;
    this.spoolDialogError = '';
  }

  submitOpenSpool(): void {
    const location = this.buildLocation();
    if (!location || !this.openSupplyId) {
      this.spoolDialogError = 'Completá insumo y ubicación.';
      return;
    }
    this.spoolDialogBusy = true;
    this.spoolDialogError = '';
    this.spoolsService
      .open({
        supplyId: this.openSupplyId,
        grams: Number(this.openGrams) || undefined,
        location,
      })
      .subscribe({
        next: (spool) => {
          this.upsertSpoolLocal(spool);
          this.closeSpoolDialog();
          this.flashStatusNotice('Bobina abierta');
          this.refreshSuppliesAndAux();
        },
        error: (err) => {
          this.spoolDialogBusy = false;
          this.spoolDialogError = extractApiErrorMessage(
            err,
            'No se pudo abrir la bobina',
          );
          this.toastError(err, 'No se pudo abrir la bobina');
        },
      });
  }

  submitMoveSpool(): void {
    if (!this.selectedSpool) return;
    const location = this.buildLocation();
    if (!location) {
      this.spoolDialogError = 'Completá la ubicación.';
      return;
    }
    this.spoolDialogBusy = true;
    this.spoolsService.move(this.selectedSpool.id, { location }).subscribe({
      next: (spool) => {
        this.upsertSpoolLocal(spool);
        this.closeSpoolDialog();
        this.flashStatusNotice('Bobina movida');
        this.refreshSuppliesAndAux();
      },
      error: (err) => {
        this.spoolDialogBusy = false;
        this.spoolDialogError = extractApiErrorMessage(
          err,
          'No se pudo mover la bobina',
        );
        this.toastError(err, 'No se pudo mover la bobina');
      },
    });
  }

  submitAdjustSpool(): void {
    if (!this.selectedSpool) return;
    this.spoolDialogBusy = true;
    this.spoolsService
      .adjust(this.selectedSpool.id, {
        remainingGrams: Number(this.adjustGrams) || 0,
      })
      .subscribe({
        next: (spool) => {
          this.upsertSpoolLocal(spool);
          this.closeSpoolDialog();
          this.flashStatusNotice('Peso ajustado');
          this.refreshSuppliesAndAux();
        },
        error: (err) => {
          this.spoolDialogBusy = false;
          this.spoolDialogError = extractApiErrorMessage(
            err,
            'No se pudo ajustar el peso',
          );
          this.toastError(err, 'No se pudo ajustar el peso');
        },
      });
  }

  openOrderDraftDialog(): void {
    this.clearStatusNotice();
    const first =
      this.orderSupplierOptions.find((o) =>
        this.reorderRows.some(
          (r) => r.supplier?.id === o.value && r.suggestedQuantity > 0,
        ),
      )?.value ??
      this.orderSupplierOptions[0]?.value ??
      '';
    this.orderSupplierId = first;
    this.orderDraftText = '';
    this.orderDraftHasLines = false;
    this.orderCopyNotice = '';
    this.spoolDialogError = '';
    this.spoolDialog = 'order';
    if (first) this.loadOrderDraft(first);
  }

  onOrderSupplierChange(id: string): void {
    this.orderSupplierId = id;
    this.orderCopyNotice = '';
    this.loadOrderDraft(id);
  }

  copyOrderDraft(): void {
    const text = this.orderDraftText;
    if (!text || !this.orderDraftHasLines) return;
    try {
      void navigator.clipboard.writeText(text).then(
        () => this.flashOrderCopyNotice('Copiado'),
        () => this.flashOrderCopyNotice('No se pudo copiar'),
      );
    } catch {
      this.flashOrderCopyNotice('No se pudo copiar');
    }
  }

  expandAlerts(): void {
    this.alertsExpanded = true;
  }

  openReorderSupply(supplyId: string): void {
    const supply = this.supplies.find((s) => s.id === supplyId);
    if (supply) this.openEdit(supply);
  }

  reorderPill(row: ReorderRow): { label: string; tone: 'danger' | 'warn' | 'ok' } {
    if (row.reason === 'out_of_stock' || row.reason === 'below_min') {
      return { label: 'Ya', tone: 'danger' };
    }
    if (row.status === 'ok') {
      return { label: 'sin apuro', tone: 'ok' };
    }
    if (!row.orderBy) {
      return row.status === 'urgent'
        ? { label: 'Ya', tone: 'danger' }
        : { label: 'pronto', tone: 'warn' };
    }
    const label = formatYmdWeekdayDdMm(row.orderBy, { short: true });
    if (row.status === 'urgent') return { label, tone: 'danger' };
    return { label, tone: 'warn' };
  }

  formatReorderAlert(alert: Extract<SpoolAlert, { kind: 'reorder' }>): {
    title: string;
    body: string;
  } {
    const stockLabel =
      alert.stock != null && alert.unit
        ? formatSupplyQuantity(alert.stock, alert.unit)
        : alert.stockLabel;
    const hasSupplier = !!alert.supplierName?.trim();
    const supplier = alert.supplierName?.trim() ?? '';
    const lead =
      alert.leadTimeBusinessDays != null
        ? alert.leadTimeBusinessDays
        : null;
    const assignHint = hasSupplier
      ? ''
      : ' Asignale un proveedor para calcular cuándo pedir.';

    if (alert.reason === 'out_of_stock') {
      const supplierBit =
        hasSupplier && lead != null
          ? ` a ${supplier} (tarda ${formatLeadTimeBusinessDays(lead)})`
          : hasSupplier
            ? ` a ${supplier}`
            : '';
      return {
        title: `${alert.name}: sin stock.`,
        body: `Pedilo ya${supplierBit}.${assignHint}`.trim(),
      };
    }

    if (alert.reason === 'below_min') {
      const supplierBit = hasSupplier ? ` a ${supplier}` : '';
      return {
        title: `${alert.name}: por debajo del mínimo.`,
        body: `Te quedan ${stockLabel}; pedilo${supplierBit}.${assignHint}`.trim(),
      };
    }

    // forecast (o legacy sin reason)
    const day = alert.orderBy ? formatYmdWeekdayDdMm(alert.orderBy) : '';
    const coversDays =
      alert.coversDays != null
        ? Math.max(0, Math.round(alert.coversDays))
        : null;
    if (day && coversDays != null && hasSupplier && lead != null) {
      return {
        title: `${alert.name}: pedilo antes del ${day}.`,
        body: `Te quedan ${stockLabel} (unos ${coversDays} días al ritmo actual) y ${supplier} tarda ${formatLeadTimeBusinessDays(lead)}.${assignHint}`.trim(),
      };
    }
    if (day && coversDays != null) {
      return {
        title: `${alert.name}: pedilo antes del ${day}.`,
        body: `Te quedan ${stockLabel} (unos ${coversDays} días al ritmo actual).${assignHint}`.trim(),
      };
    }
    return {
      title: `${alert.name}: conviene reponer.`,
      body: `Te quedan ${stockLabel}.${assignHint}`.trim(),
    };
  }

  formatSpoolShortAlert(
    alert: Extract<SpoolAlert, { kind: 'spool_short' }>,
  ): { title: string; body: string } {
    return {
      title: `Bobina ${alert.code} no alcanza`,
      body: `para la próxima tarea de ${alert.printerName} (necesita ${formatSupplyGrams(alert.needGrams)}, quedan ${formatSupplyGrams(alert.remainingGrams)}). Prepará un repuesto.`,
    };
  }

  private refreshSuppliesAndAux(): void {
    this.suppliesFacade.refresh();
    this.loadAuxData();
  }

  private upsertSpoolLocal(spool: Spool): void {
    const idx = this.spools.findIndex((s) => s.id === spool.id);
    if (spool.finishedAt) {
      this.spools =
        idx >= 0
          ? this.spools.filter((s) => s.id !== spool.id)
          : this.spools;
      return;
    }
    if (idx >= 0) {
      this.spools = this.spools.map((s) => (s.id === spool.id ? spool : s));
    } else {
      this.spools = [...this.spools, spool];
    }
  }

  private flashStatusNotice(message: string): void {
    this.clearStatusNotice();
    this.statusNotice = message;
    this.statusNoticeTimer = setTimeout(() => {
      this.statusNotice = '';
      this.statusNoticeTimer = null;
    }, 3000);
  }

  private clearStatusNotice(): void {
    if (this.statusNoticeTimer) {
      clearTimeout(this.statusNoticeTimer);
      this.statusNoticeTimer = null;
    }
    this.statusNotice = '';
  }

  private loadAuxData(): void {
    forkJoin({
      spools: this.spoolsService.list({ open: true }).pipe(catchError(() => of([]))),
      alerts: this.spoolsService.alerts().pipe(catchError(() => of([]))),
      reorder: this.suppliesService.getReorder().pipe(
        catchError(() =>
          of({
            rows: [] as ReorderRow[],
            openSpools: 0,
            urgentCount: 0,
          }),
        ),
      ),
      summary: this.suppliesService.getReorderSummary().pipe(
        catchError(() => of({ openSpools: 0, urgentCount: 0, total: 0 })),
      ),
      suppliers: this.suppliersService.list().pipe(catchError(() => of([]))),
      settings: this.settingsService.getGeneralSettings(false).pipe(
        catchError(() => of(null)),
      ),
    }).subscribe(({ spools, alerts, reorder, summary, suppliers, settings }) => {
      this.spools = spools;
      this.spoolAlerts = alerts;
      this.reorderRows = reorder.rows;
      this.reorderCounts = summary;
      this.suppliers = suppliers;
      if (settings) {
        this.colorCatalog = settings.colors ?? [];
        this.printers = (settings.machineProfiles ?? []).filter(
          (p) =>
            p.role === MachineProfileRole.PRINT &&
            p.queueEnabled &&
            !!p.id,
        );
      }
    });
  }

  private loadColorCatalog(): void {
    const cached = this.settingsService.peekGeneralSettings();
    if (cached) {
      this.colorCatalog = cached.colors ?? [];
      this.printers = (cached.machineProfiles ?? []).filter(
        (p) => p.role === MachineProfileRole.PRINT && p.queueEnabled,
      );
      return;
    }
    this.settingsService.getGeneralSettings().subscribe({
      next: (settings) => {
        this.colorCatalog = settings.colors ?? [];
        this.printers = (settings.machineProfiles ?? []).filter(
          (p) => p.role === MachineProfileRole.PRINT && p.queueEnabled,
        );
      },
    });
  }

  private loadOrderDraft(supplierId: string): void {
    if (!supplierId) {
      this.orderDraftText = '';
      this.orderDraftHasLines = false;
      return;
    }
    this.suppliersService.orderDraft(supplierId).subscribe({
      next: (draft) => {
        this.orderDraftHasLines = draft.lines.length > 0;
        this.orderDraftText = this.orderDraftHasLines ? draft.text : '';
      },
      error: (err) => {
        this.orderDraftText = '';
        this.orderDraftHasLines = false;
        this.spoolDialogError = extractApiErrorMessage(
          err,
          'No se pudo armar el pedido',
        );
      },
    });
  }

  private flashOrderCopyNotice(text: string): void {
    this.orderCopyNotice = text;
    if (this.orderCopyTimer) clearTimeout(this.orderCopyTimer);
    this.orderCopyTimer = setTimeout(() => {
      this.orderCopyNotice = '';
      this.orderCopyTimer = null;
    }, 2000);
  }

  private buildLocation(): SpoolLocation | null {
    if (this.locationKind === 'printer') {
      if (!this.locationPrinterId) return null;
      return {
        kind: 'printer',
        printerId: this.locationPrinterId,
        slot: Number(this.locationSlot) || 1,
      };
    }
    const text = this.locationShelf.trim();
    if (!text) return null;
    return { kind: 'shelf', text };
  }

  private occupiedSlots(
    printerId: string,
    ignoreSpoolId?: string,
  ): Set<number> {
    const set = new Set<number>();
    if (!printerId) return set;
    for (const spool of this.spools) {
      if (spool.finishedAt) continue;
      if (ignoreSpoolId && spool.id === ignoreSpoolId) continue;
      if (
        spool.location.kind === 'printer' &&
        spool.location.printerId === printerId
      ) {
        set.add(Number(spool.location.slot));
      }
    }
    return set;
  }

  private openRemainingGrams(supplyId: string): number {
    return this.spools
      .filter((s) => !s.finishedAt && s.supplyId === supplyId)
      .reduce((sum, s) => sum + Number(s.remainingGrams), 0);
  }

  private closedGrams(supply: Supply): number {
    return Math.max(
      0,
      supplyQuantityToGrams(supply) - this.openRemainingGrams(supply.id),
    );
  }

  private gramsToSupplyQuantity(
    supply: Pick<Supply, 'unit'>,
    grams: number,
  ): number {
    const unit = (supply.unit || '').trim();
    if (unit === 'kg') return grams / 1000;
    if (unit === 'g') return grams;
    return grams;
  }

  private defaultGramsForSupply(supplyId: string): number {
    const supply = this.supplies.find((s) => s.id === supplyId);
    const grams = supply?.spoolGrams;
    if (grams != null && Number(grams) > 0) return Math.trunc(Number(grams));
    return 1000;
  }

  private formatSpoolLocation(
    spool: Spool,
    printerById: Map<string, MachineProfile>,
  ): string {
    if (spool.location.kind === 'shelf') {
      return spool.location.text;
    }
    const printer =
      printerById.get(spool.location.printerId)?.name ?? 'Impresora';
    return `${printer} · AMS ranura ${spool.location.slot}`;
  }

  private toastError(err: unknown, fallback: string): void {
    this.flashStatusNotice(
      extractApiErrorMessage(
        err as { error?: { message?: string | string[] } },
        fallback,
      ),
    );
  }

  private supplySearchText(supply: Supply): string {
    const material = supply.filamentType
      ? FILAMENT_TYPE_LABELS[supply.filamentType]
      : supply.resinType
        ? (RESIN_TYPE_LABELS[supply.resinType as ResinType] ?? supply.resinType)
        : '';
    return [
      supply.name,
      supply.brand,
      SUPPLY_CATEGORY_LABELS[supply.category],
      material,
      supply.colorId
        ? resolveColorLabel(supply.colorId, this.colorCatalog)
        : '',
    ]
      .filter((part) => Boolean(part))
      .map((part) => normalizeSearchText(part))
      .join(' ');
  }
}
