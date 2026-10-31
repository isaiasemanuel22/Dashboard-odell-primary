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
  GeneralSettings,
  INDISTINTO_COLOR_ID,
} from '../../core/models';
import { SettingsFacade } from '../../store/settings/settings.facade';
import { buildFilamentTypeOptions } from '../../shared/utils/filament-type.util';
import { resolveFilamentPricePerKg } from '../../shared/utils/material-type-price.util';
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
      },
      {
        type: 'select',
        name: 'filamentType',
        label: 'Filamento',
        optionsFn: (item, items) => this.getFilamentTypeOptions(item, items),
        changeFn: (item) => {
          item.colorId = INDISTINTO_COLOR_ID;
        },
      },
      {
        type: 'input',
        name: 'label',
        label: 'Etiqueta',
        placeholder: 'Ej.: Base',
      },
      {
        type: 'input',
        name: 'grams',
        label: 'Gramos',
        inputType: 'number',
        suffix: 'g',
        min: 0,
        step: 0.1,
      },
    ],
  };

  ngOnInit(): void {
    if (this.embedded) {
      this.filamentConfig.addPlacement = 'inside';
      this.filamentConfig.tableColumns =
        'minmax(0, 0.85fr) minmax(0, 1.4fr) minmax(0, 0.75fr) 5.25rem minmax(4.5rem, 5.25rem) 1.6rem';
    }
    this.settingsFacade
      .watchUntilDestroyed(this.destroyRef)
      .subscribe((settings) => {
        this.generalSettings = settings;
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
    const prices = this.generalSettings.filamentPrices.filter(
      (entry) => entry.materialType === type,
    );
    const perKg = resolveFilamentPricePerKg(
      this.generalSettings,
      type as FilamentType,
    );
    const typeLabel = FILAMENT_TYPE_LABELS[type as FilamentType] ?? fallback;
    if (perKg == null) return typeLabel;
    const price = `${this.money(perKg)}/kg`;
    if (prices.length === 1) {
      return `${prices[0].brand} · ${typeLabel} · ${price}`;
    }
    return `${typeLabel} · ${price}`;
  }

  private lineCost(line: FdmFilamentLine): number {
    if (!this.generalSettings || !line?.filamentType) return 0;
    const perKg = resolveFilamentPricePerKg(
      this.generalSettings,
      line.filamentType,
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
