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
} from '../../../core/models';
import { SettingsFacade } from '../../../store/settings/settings.facade';
import {
  resinMaterialCost,
  resolveResinPricePerLiter,
} from '../../../shared/utils/material-type-price.util';
import {
  buildResinTypeOptions,
  resinTypeDisplayLabel,
} from '../../../shared/utils/resin-type.util';
import type { DbSelectOption } from '@dashboard-form';
import { ProductFormGroup } from '../../../pages/products/product-form/services/product-form-state-manager.service';
import {
  DynamicListComponent,
  DynamicListConfig,
} from '../dynamic-list/dynamic-list.component';

interface ResinTableLine {
  id: string;
  colorId: string;
  resinType: ResinType | string;
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
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();
  private generalSettings: GeneralSettings | null = null;
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
      return `Total ${grams} ml · Material ${this.money(this.lineCost(line))}`;
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
        resinTypeFrom: (item) => item?.resinType ?? null,
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
        label: 'Mililitros',
        inputType: 'number',
        suffix: 'ml',
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
    const current = this.form.controls.resinType.value;
    const options = buildResinTypeOptions(
      this.generalSettings?.resinTypes ?? [],
      this.generalSettings?.resinPrices ?? [],
      current ? [String(current)] : [],
      'code',
    );
    return [
      { value: '', label: 'Elegí el tipo' },
      ...options.map((option) => ({
        ...option,
        label: this.resinOptionLabel(String(option.value), option.label),
      })),
    ];
  }

  private resinOptionLabel(type: string, fallback: string): string {
    if (!this.generalSettings) return fallback;
    const catalog = this.generalSettings.resinTypes ?? [];
    const prices = this.generalSettings.resinPrices.filter(
      (entry) => entry.resinType === type,
    );
    const perLiter = resolveResinPricePerLiter(this.generalSettings, type);
    const typeLabel = resinTypeDisplayLabel(type, catalog) || fallback;
    if (perLiter == null) return `${typeLabel} · falta precio`;
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
}
