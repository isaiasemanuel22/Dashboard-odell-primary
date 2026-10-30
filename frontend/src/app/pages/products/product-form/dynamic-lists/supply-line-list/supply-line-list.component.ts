import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnDestroy,
  OnInit,
  forwardRef,
  inject,
} from '@angular/core';
import {
  ControlValueAccessor,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';
import {
  EstampadoSupplyLine,
  GeneralSettings,
  INDISTINTO_COLOR_ID,
  Supply,
  SupplyCategory,
} from '../../../../../core/models';
import { SuppliesService } from '../../../../../core/services/settings.service';
import { SettingsFacade } from '../../../../../store/settings/settings.facade';
import { createEmptyEstampadoSupplyLine } from '../../../../../shared/utils/estampado.helpers';
import { buildColorOptions } from '../../../../../shared/utils/color.helpers';
import type { DbSelectOption } from '@dashboard-form';
import { Subject, takeUntil } from 'rxjs';
import {
  DynamicListComponent,
  DynamicListConfig,
} from '../dynamic-list/dynamic-list.component';

@Component({
  selector: 'app-supply-line-list',
  standalone: true,
  imports: [DynamicListComponent],
  template: `
    <app-dynamic-list
      [initialValue]="initialValue"
      [config]="supplyConfig"
      [embedded]="embedded"
      [locked]="locked"
      (valueChange)="onListChange($event)"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SupplyLineListComponent),
      multi: true,
    },
  ],
})
export class SupplyLineListComponent
  implements OnInit, OnDestroy, ControlValueAccessor
{
  @Input() embedded = false;
  @Input() locked = false;
  initialValue: EstampadoSupplyLine[] | null = null;

  private readonly suppliesService = inject(SuppliesService);
  private readonly settingsFacade = inject(SettingsFacade);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();
  private suppliesCatalog: Supply[] = [];
  private generalSettings: GeneralSettings | null = null;
  private onChange: (value: EstampadoSupplyLine[]) => void = () => {};
  private onTouched: () => void = () => {};

  readonly supplyConfig: DynamicListConfig = {
    legend: 'Insumos',
    description:
      'Prenda, taza o soporte que se estampa. El costo sale del precio unitario en Insumos.',
    layout: 'table',
    addPlacement: 'inside',
    tableColumns: 'minmax(14rem, 2.2fr) 7.5rem 5.75rem 4.75rem 2rem',
    itemLabel: (index) => `Insumo ${index + 1}`,
    addButtonLabel: '+ Agregar insumo',
    emptyMessage: 'Sin insumos configurados',
    totalValueFn: (items) => {
      const total = items.reduce((sum, line) => sum + this.lineCost(line), 0);
      return `Insumos ${this.money(total)}`;
    },
    rowCost: (item) => this.lineCost(item),
    displayColumns: [
      {
        label: 'Precio / u',
        render: (item) => this.unitPriceCell(item),
      },
    ],
    minItems: 0,
    createItem: () => createEmptyEstampadoSupplyLine(),
    fields: [
      {
        type: 'select',
        name: 'supplyId',
        label: 'Insumo',
        placeholder: 'Seleccionar insumo...',
        optionsFn: (item, items) => this.getSupplyOptionsFor(item, items),
        changeFn: (item) => {
          item.colorId = INDISTINTO_COLOR_ID;
        },
      },
      {
        type: 'input',
        name: 'quantity',
        label: 'Cantidad',
        inputType: 'number',
        min: 0.01,
        step: 1,
        control: 'stepper',
      },
      {
        type: 'input',
        name: 'label',
        label: 'Etiqueta',
        hidden: true,
      },
      {
        type: 'color-select',
        name: 'colorId',
        label: 'Color',
        hidden: true,
        optionsFn: (item) => this.getColorOptions(item),
      },
    ],
  };

  ngOnInit(): void {
    this.settingsFacade
      .watchGeneralSettings()
      .pipe(takeUntil(this.destroy$))
      .subscribe((settings) => {
        this.generalSettings = settings;
        this.cdr.markForCheck();
      });

    this.suppliesService
      .watchSupplies(SupplyCategory.ESTAMPADO)
      .pipe(takeUntil(this.destroy$))
      .subscribe((items: Supply[]) => {
        this.suppliesCatalog = items;
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  writeValue(value: EstampadoSupplyLine[] | null): void {
    this.initialValue = value;
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (value: EstampadoSupplyLine[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.locked = isDisabled;
    this.cdr.markForCheck();
  }

  onListChange(value: EstampadoSupplyLine[]): void {
    this.onChange(value);
    this.onTouched();
  }

  private getSupplyOptionsFor(
    line: EstampadoSupplyLine,
    allLines: EstampadoSupplyLine[],
  ): DbSelectOption[] {
    const usedSupplyIds = new Set(
      allLines
        .filter((item) => item.id !== line.id && item.supplyId)
        .map((item) => item.supplyId),
    );

    return this.suppliesCatalog
      .filter((supply) => !usedSupplyIds.has(supply.id))
      .map((supply) => ({
        value: supply.id,
        label: `${supply.name} · ${this.quantityLabel(supply.quantity)} ${supply.unit} en stock`,
      }));
  }

  private unitPriceCell(line: EstampadoSupplyLine) {
    const supply = this.suppliesCatalog.find((item) => item.id === line.supplyId);
    const price = Number(supply?.unitPrice) || 0;
    if (!supply || price <= 0) {
      return { text: this.money(0), hint: 'Falta precio', tone: 'missing' as const };
    }
    return { text: this.money(price), tone: 'plain' as const };
  }

  private lineCost(line: EstampadoSupplyLine): number {
    const supply = this.suppliesCatalog.find((item) => item.id === line.supplyId);
    if (!supply) return 0;
    return (Number(supply.unitPrice) || 0) * (Number(line.quantity) || 0);
  }

  private quantityLabel(value: number): string {
    return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(
      Number(value) || 0,
    );
  }

  private money(value: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(value);
  }

  private getColorOptions(line: EstampadoSupplyLine): DbSelectOption[] {
    return buildColorOptions(
      this.suppliesCatalog,
      this.generalSettings?.colors ?? [],
      { supplyId: line.supplyId },
    );
  }
}
