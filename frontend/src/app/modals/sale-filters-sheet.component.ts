import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
} from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { SaleEntry, SaleSource, ServiceType } from '../core/models';
import {
  AreaServiceType,
  SALE_SOURCE_LABELS,
  SERVICE_TYPE_LABELS,
} from '../shared/constants/labels';
import {
  DbButtonComponent,
  MobileChipGroupComponent,
} from '@general-components';

export type SaleMobileSourceFilter = SaleSource | 'all';
export type SaleMobileAreaFilter = AreaServiceType | 'all';

export interface SaleMobileSheetFilters {
  source: SaleMobileSourceFilter;
  area: SaleMobileAreaFilter;
}

export interface SaleFiltersSheetData {
  filters: SaleMobileSheetFilters;
  /** Lista del mes (sin filtros de hoja) para el contador en vivo. */
  entries: SaleEntry[];
}

const SALE_AREAS: AreaServiceType[] = [
  ServiceType.IMPRESION_3D,
  ServiceType.DISENO_GRAFICO,
  ServiceType.MODELADO,
  ServiceType.ESTAMPADO,
];

@Component({
  standalone: true,
  imports: [DbButtonComponent, MobileChipGroupComponent],
  templateUrl: './sale-filters-sheet.component.html',
  styleUrl: './sale-filters-sheet.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SaleFiltersSheetComponent {
  private readonly data = inject<SaleFiltersSheetData>(DIALOG_DATA);
  private readonly dialogRef =
    inject<DialogRef<SaleMobileSheetFilters | undefined>>(DialogRef);
  private readonly cdr = inject(ChangeDetectorRef);

  draft: SaleMobileSheetFilters = cloneFilters(this.data.filters);

  readonly sourceOptions: { value: SaleMobileSourceFilter; label: string }[] = [
    { value: 'all', label: 'Todas' },
    {
      value: SaleSource.RETAIL,
      label: SALE_SOURCE_LABELS[SaleSource.RETAIL],
    },
    {
      value: SaleSource.ORDER,
      label: SALE_SOURCE_LABELS[SaleSource.ORDER],
    },
  ];

  readonly areaOptions: { value: SaleMobileAreaFilter; label: string }[] = [
    { value: 'all', label: 'Todas' },
    ...SALE_AREAS.map((area) => ({
      value: area as SaleMobileAreaFilter,
      label: SERVICE_TYPE_LABELS[area],
    })),
  ];

  get matchCount(): number {
    return this.data.entries.filter((entry) =>
      matchesSaleSheetFilters(entry, this.draft),
    ).length;
  }

  get applyLabel(): string {
    const n = this.matchCount;
    return n === 1 ? 'Ver 1 venta' : `Ver ${n} ventas`;
  }

  onSourceChange(value: SaleMobileSourceFilter | null): void {
    if (value == null) return;
    this.draft = { ...this.draft, source: value };
    this.cdr.markForCheck();
  }

  onAreaChange(value: SaleMobileAreaFilter | null): void {
    if (value == null) return;
    this.draft = { ...this.draft, area: value };
    this.cdr.markForCheck();
  }

  clearAll(): void {
    this.draft = emptySaleMobileSheetFilters();
    this.cdr.markForCheck();
  }

  apply(): void {
    this.dialogRef.close(cloneFilters(this.draft));
  }

  cancel(): void {
    this.dialogRef.close(undefined);
  }
}

export function emptySaleMobileSheetFilters(): SaleMobileSheetFilters {
  return { source: 'all', area: 'all' };
}

export function countSaleMobileSheetFilters(
  filters: SaleMobileSheetFilters,
): number {
  let n = 0;
  if (filters.source !== 'all') n += 1;
  if (filters.area !== 'all') n += 1;
  return n;
}

/** Mismos predicados que `sourceFilters` / `areaFilters` de ventas desktop. */
export function matchesSaleSheetFilters(
  entry: SaleEntry,
  filters: SaleMobileSheetFilters,
): boolean {
  if (filters.source !== 'all' && entry.source !== filters.source) {
    return false;
  }
  if (filters.area !== 'all') {
    const area = filters.area;
    if (!entry.items.some((item) => item.serviceType === area)) {
      return false;
    }
  }
  return true;
}

function cloneFilters(filters: SaleMobileSheetFilters): SaleMobileSheetFilters {
  return { source: filters.source, area: filters.area };
}
