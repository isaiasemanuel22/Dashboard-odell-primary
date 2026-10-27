import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { merge, Subject, takeUntil } from 'rxjs';
import {
  GeneralSettings,
  INDISTINTO_COLOR_ID,
  ResinType,
  Supply,
  SupplyCategory,
} from '../../../../../core/models';
import { SettingsFacade } from '../../../../../store/settings/settings.facade';
import { SuppliesService } from '../../../../../core/services/settings.service';
import { RESIN_TYPE_LABELS } from '../../../../../shared/constants/labels';
import {
  resinMaterialCost,
  resolveResinPricePerLiter,
} from '../../../../../shared/utils/material-type-price.util';
import { resinTypeOptions } from '../../../../../shared/utils/select-options';
import type { DbColorSelectOption, DbSelectOption } from '@dashboard-form';
import { ProductFormGroup } from '../../services/product-form-state-manager.service';
import {
  DynamicListComponent,
  DynamicListConfig,
} from '../dynamic-list/dynamic-list.component';

interface ResinTableLine {
  id: string;
  colorId: string;
  resinType: ResinType | '';
  grams: number;
}

@Component({
  selector: 'app-resin-line-list',
  standalone: true,
  imports: [DynamicListComponent],
  template: `
    <app-dynamic-list
      [initialValue]="initialValue"
      [config]="resinConfig"
      (valueChange)="onListChange($event)"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResinLineListComponent implements OnInit, OnDestroy {
  @Input({ required: true }) form!: ProductFormGroup;

  initialValue: ResinTableLine[] | null = null;

  private readonly settingsFacade = inject(SettingsFacade);
  private readonly suppliesService = inject(SuppliesService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();
  private generalSettings: GeneralSettings | null = null;
  private resinSupplies: Supply[] = [];
  private writing = false;

  readonly resinConfig: DynamicListConfig = {
    legend: 'Resina',
    description: 'Material y color de la impresión',
    layout: 'table',
    tableColumns:
      'minmax(8.75rem, 1.15fr) minmax(12rem, 2fr) 6.25rem 4.75rem 2rem',
    showAddButton: false,
    itemLabel: () => 'Resina',
    addButtonLabel: '',
    totalValueFn: (items) => {
      const line = items[0] as ResinTableLine | undefined;
      const grams = Number(line?.grams) || 0;
      return `Total ${grams} g · Material ${this.money(this.lineCost(line))}`;
    },
    rowCost: (item) => this.lineCost(item),
    minItems: 1,
    createItem: () => this.readLine(),
    showRemoveButton: () => false,
    fields: [
      {
        type: 'color-select',
        name: 'colorId',
        label: 'Color',
        appearance: 'popover',
        optionsFn: (item) => this.getColorOptions(item),
      },
      {
        type: 'select',
        name: 'resinType',
        label: 'Resina',
        optionsFn: () => this.getResinTypeOptions(),
        changeFn: (item) => {
          item.colorId = INDISTINTO_COLOR_ID;
        },
      },
      {
        type: 'input',
        name: 'grams',
        label: 'Gramos',
        inputType: 'number',
        suffix: 'g',
        min: 0,
        step: 0.1,
        required: true,
      },
    ],
  };

  ngOnInit(): void {
    this.initialValue = [this.readLine()];

    this.settingsFacade
      .watchGeneralSettings()
      .pipe(takeUntil(this.destroy$))
      .subscribe((settings) => {
        this.generalSettings = settings;
        this.cdr.markForCheck();
      });

    this.suppliesService
      .watchSupplies(SupplyCategory.RESINA)
      .pipe(takeUntil(this.destroy$))
      .subscribe((items) => {
        this.resinSupplies = items.filter((supply) => Boolean(supply.resinType));
        this.cdr.markForCheck();
      });

    merge(
      this.form.controls.resinType.valueChanges,
      this.form.controls.colorId.valueChanges,
      this.form.controls.grams.valueChanges,
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.writing) return;
        this.initialValue = [this.readLine()];
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onListChange(value: ResinTableLine[]): void {
    const line = value[0] ?? this.readLine();
    this.writing = true;
    this.form.patchValue({
      resinType: line.resinType as ResinType,
      colorId: line.colorId || INDISTINTO_COLOR_ID,
      grams: Number(line.grams) || 0,
    });
    this.writing = false;
  }

  private readLine(): ResinTableLine {
    return {
      id: 'resin',
      colorId: this.form.controls.colorId.value || INDISTINTO_COLOR_ID,
      resinType: this.form.controls.resinType.value,
      grams: Number(this.form.controls.grams.value) || 0,
    };
  }

  private getResinTypeOptions(): DbSelectOption[] {
    return [
      { value: '', label: 'Elegí el tipo' },
      ...resinTypeOptions().map((option) => ({
        value: option.value,
        label: this.resinOptionLabel(option.value, option.label),
      })),
    ];
  }

  private resinOptionLabel(type: ResinType, fallback: string): string {
    if (!this.generalSettings) return fallback;
    const prices = this.generalSettings.resinPrices.filter(
      (entry) => entry.resinType === type,
    );
    const perLiter = resolveResinPricePerLiter(this.generalSettings, type);
    const typeLabel = RESIN_TYPE_LABELS[type] ?? fallback;
    if (perLiter == null) return typeLabel;
    const price = `${this.money(perLiter)}/L`;
    if (prices.length === 1) {
      return `${prices[0].brand} · ${typeLabel} · ${price}`;
    }
    return `${typeLabel} · ${price}`;
  }

  private lineCost(line: ResinTableLine | undefined): number {
    if (!this.generalSettings || !line?.resinType) return 0;
    return resinMaterialCost(
      this.generalSettings,
      line.resinType,
      Number(line.grams) || 0,
    );
  }

  private money(value: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(value);
  }

  private getColorOptions(line: ResinTableLine): DbColorSelectOption[] {
    const catalog = this.generalSettings?.colors ?? [];
    const stockIds = new Set(
      this.resinSupplies
        .filter(
          (supply) => !line.resinType || supply.resinType === line.resinType,
        )
        .map((supply) => supply.colorId)
        .filter((colorId): colorId is string => !!colorId),
    );
    const options: DbColorSelectOption[] = [
      {
        value: INDISTINTO_COLOR_ID,
        label: 'Indistinto',
        hint: 'el que haya en stock',
      },
    ];

    for (const color of catalog) {
      options.push({
        value: color.id,
        label: color.name,
        hex: color.hex,
        inStock: stockIds.has(color.id),
      });
    }

    return options;
  }
}
