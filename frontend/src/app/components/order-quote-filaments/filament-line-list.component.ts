import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnDestroy,
  OnInit,
  forwardRef,
  inject, DestroyRef } from '@angular/core';
import {
  ControlValueAccessor,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import {
  FdmFilamentLine,
  FilamentType,
  Supply,
  GeneralSettings,
  INDISTINTO_COLOR_ID,
} from '../../core/models';
import { SettingsFacade } from '../../store/settings/settings.facade';
import { buildFilamentTypeOptions } from '../../shared/utils/filament-type.util';
import { Store } from '@ngrx/store';
import { selectSupplies } from '../../store/supplies/supplies.selectors';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { resolveFilamentPricePerKg, resolveFilamentMaterialPrice, materialPriceSourceLabel } from '../../shared/utils/material-type-price.util';
import { FILAMENT_TYPE_LABELS } from '../../shared/constants/labels';
import {
  createEmptyFdmFilamentLine,
  totalFdmFilamentGrams,
} from '../../shared/utils/fdm.helpers';
import type { DbSelectOption } from '@dashboard-form';
import {
  DynamicListComponent,
  DynamicListConfig,
} from '../dynamic-lists/dynamic-list/dynamic-list.component';

@Component({
  selector: 'app-filament-line-list',
  standalone: true,
  imports: [DynamicListComponent],
  template: `
    <app-dynamic-list
      [initialValue]="initialValue"
      [config]="filamentConfig"
      [embedded]="embedded"
      [locked]="locked"
      [optionsEpoch]="optionsEpoch"
      (valueChange)="onListChange($event)"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => FilamentLineListComponent),
      multi: true,
    },
  ],
})
export class FilamentLineListComponent
  implements OnInit, OnDestroy, ControlValueAccessor
{
  @Input() primaryFilamentType: FilamentType = FilamentType.PLA;
  @Input() embedded = false;
  @Input() locked = false;

  initialValue: FdmFilamentLine[] | null = null;
  /** Fuerza a DynamicList (OnPush) a re-leer optionsFn de tipos. */
  optionsEpoch = 0;

  private readonly settingsFacade = inject(SettingsFacade);
  private readonly ngrxStore = inject(Store);
  private supplies: Supply[] = [];
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();
  private generalSettings: GeneralSettings | null = null;
  private onChange: (value: FdmFilamentLine[]) => void = () => {};
  private onTouched: () => void = () => {};

  filamentConfig: DynamicListConfig<FdmFilamentLine> = {
    legend: 'Filamentos',
    description: 'Uno por cada material o color que usa la impresión',
    layout: 'table',
    itemLabel: (index) => `Filamento ${index + 1}`,
    addButtonLabel: '+ Agregar filamento',
    emptyMessage: 'Sin filamentos configurados',
    totalValueFn: (items) => {
      const grams = totalFdmFilamentGrams(items);
      const gramsLabel = new Intl.NumberFormat('es-AR', {
        maximumFractionDigits: 2,
      }).format(grams);
      if (this.embedded) return `Total ${gramsLabel} g`;
      const material = items.reduce(
        (sum, line) => sum + this.lineCost(line),
        0,
      );
      return `Total ${gramsLabel} g · Material ${this.money(material)}`;
    },
    rowCost: (item) => this.lineCost(item),
    rowBadge: (item) => (item.source === '3mf' ? '.3mf' : null),
    minItems: 1,
    createItem: () =>
      createEmptyFdmFilamentLine(this.primaryFilamentType),
    showRemoveButton: (items) => items.length > 1,
    fields: [
      {
        type: 'color-select',
        name: 'colorId',
        label: 'Color',
        appearance: 'popover',
        filamentTypeFrom: (item) => item?.filamentType ?? null,
        changeFn: (item) => this.clearImportSource(item),
      },
      {
        type: 'select',
        name: 'filamentType',
        label: 'Filamento',
        optionsFn: (item, items) => this.getFilamentTypeOptions(item, items),
        changeFn: (item) => {
          this.clearImportSource(item);
          item.colorId = INDISTINTO_COLOR_ID;
        },
      },
      {
        type: 'input',
        name: 'label',
        label: 'Etiqueta',
        placeholder: 'Ej.: Base',
        changeFn: (item) => this.clearImportSource(item),
      },
      {
        type: 'input',
        name: 'grams',
        label: 'Gramos',
        inputType: 'number',
        suffix: 'g',
        min: 0,
        step: 0.1,
        changeFn: (item) => this.clearImportSource(item),
      },
    ],
  };

  ngOnInit(): void {
    // Extra `auto` para el pill `.3mf` (rowBadge).
    if (this.embedded) {
      this.filamentConfig.addPlacement = 'inside';
      // min-widths razonables: evita que «Filamento» / cantidad se pisen.
      this.filamentConfig.tableColumns =
        'minmax(5.5rem, 0.9fr) minmax(7.5rem, 1.4fr) minmax(5rem, 0.85fr) minmax(5.25rem, 5.75rem) minmax(4.75rem, 5.5rem) auto 1.75rem';
    } else {
      this.filamentConfig.tableColumns =
        'minmax(8.75rem, 1.05fr) minmax(12rem, 1.75fr) minmax(8rem, 1.15fr) 6.25rem 4.75rem auto 2rem';
    }
    this.settingsFacade
      .watchUntilDestroyed(this.destroyRef)
      .subscribe((settings) => {
        this.generalSettings = settings;
        this.optionsEpoch++;
        this.cdr.markForCheck();
      });

    this.ngrxStore
      .select(selectSupplies)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((items) => {
        this.supplies = items;
        this.optionsEpoch++;
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  writeValue(value: FdmFilamentLine[] | null): void {
    this.initialValue = value;
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (value: FdmFilamentLine[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.locked = isDisabled;
    this.cdr.markForCheck();
  }

  onListChange(value: FdmFilamentLine[]): void {
    this.onChange(value);
    this.onTouched();
  }

  private clearImportSource(item: FdmFilamentLine): void {
    if (item.source) {
      item.source = null;
    }
  }

  private getFilamentTypeOptions(
    line: FdmFilamentLine,
    allLines: FdmFilamentLine[],
  ): DbSelectOption[] {
    const extraTypes = [
      ...allLines.map((f) => f.filamentType).filter(Boolean),
      this.primaryFilamentType,
      line.filamentType,
    ];

    const options = buildFilamentTypeOptions(
      this.generalSettings?.filamentTypes ?? [],
      this.generalSettings?.filamentPrices ?? [],
      extraTypes,
      'code',
    );
    return [
      { value: '', label: 'Elegí el tipo' },
      ...options.map((option) => ({
        ...option,
        label: this.filamentOptionLabel(String(option.value), option.label),
      })),
    ];
  }

  private filamentOptionLabel(type: string, fallback: string): string {
    if (!this.generalSettings) return fallback;
    const resolved = resolveFilamentMaterialPrice(
      this.generalSettings,
      type as FilamentType,
      this.supplies,
    );
    const typeLabel = FILAMENT_TYPE_LABELS[type as FilamentType] ?? fallback;
    if (resolved == null) return typeLabel;
    const price = `${this.money(resolved.price)}/kg · ${materialPriceSourceLabel(resolved.source)}`;
    return `${typeLabel} · ${price}`;
  }

  private lineCost(line: FdmFilamentLine): number {
    if (!this.generalSettings || !line?.filamentType) return 0;
    const perKg = resolveFilamentPricePerKg(
      this.generalSettings,
      line.filamentType,
      this.supplies,
    );
    if (perKg == null) return 0;
    return ((Number(line.grams) || 0) / 1000) * perKg;
  }

  private money(value: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(value);
  }
}
