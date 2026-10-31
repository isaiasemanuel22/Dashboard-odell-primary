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
  EstampadoPrintSpec,
  GeneralSettings,
  ImpresoWithCost,
  PaperType,
} from '../../../core/models';
import { ImpresosService } from '../../../core/services/impresos.service';
import { ProductCostCalculationService } from '../../../core/services/product-cost-calculation.service';
import { paperTypeOptions } from '../../../shared/utils/select-options';
import {
  createEmptyEstampadoPrint,
  formatPrintDimensionsCm,
  printQuantity,
  resolvePrintDimensions,
  summarizeEstampadoPrintQuantities,
  syncEstampadoPrintFromImpreso,
} from '../../../shared/utils/estampado.helpers';
import { PAPER_TYPE_LABELS } from '../../../shared/constants/labels';
import { SettingsFacade } from '../../../store/settings/settings.facade';
import type { DbSelectOption } from '@dashboard-form';
import { Subject, takeUntil } from 'rxjs';
import {
  DynamicListComponent,
  DynamicListConfig,
} from '../dynamic-list/dynamic-list.component';

@Component({
  selector: 'app-print-spec-list',
  standalone: true,
  imports: [DynamicListComponent],
  template: `
    <app-dynamic-list
      [initialValue]="initialValue"
      [config]="printConfig"
      [embedded]="embedded"
      [locked]="locked"
      (valueChange)="onListChange($event)"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PrintSpecListComponent),
      multi: true,
    },
  ],
})
export class PrintSpecListComponent
  implements OnInit, OnDestroy, ControlValueAccessor
{
  @Input() embedded = false;
  @Input() locked = false;
  initialValue: EstampadoPrintSpec[] | null = null;

  private readonly impresosService = inject(ImpresosService);
  private readonly settingsFacade = inject(SettingsFacade);
  private readonly costService = inject(ProductCostCalculationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();
  private impresos: ImpresoWithCost[] = [];
  private generalSettings: GeneralSettings | null = null;
  private onChange: (value: EstampadoPrintSpec[]) => void = () => {};
  private onTouched: () => void = () => {};

  readonly printConfig: DynamicListConfig = {
    legend: 'Impresos',
    description: 'Cada papel o transfer que lleva el producto',
    footnote:
      'Del catálogo se completa la medida; con "Medida libre" la cargás vos.',
    layout: 'table',
    addPlacement: 'inside',
    tableColumns:
      'minmax(0, 1.05fr) minmax(0, 0.72fr) minmax(0, 1.15fr) minmax(0, 0.95fr) minmax(2.4rem, 3rem) minmax(4.75rem, 5.5rem) 1.6rem',
    itemLabel: (index) => `Impreso ${index + 1}`,
    addButtonLabel: '+ Agregar impreso',
    emptyMessage: 'Sin impresos configurados',
    totalValueFn: (items) => this.printsSummary(items),
    rowCost: (item) => this.paperCost(item),
    minItems: 1,
    createItem: () => createEmptyEstampadoPrint(),
    showRemoveButton: (items) => items.length > 1,
    fields: [
      {
        type: 'input',
        name: 'label',
        label: 'Ubicación',
        placeholder: 'Ej.: Pecho',
      },
      {
        type: 'select',
        name: 'paperType',
        label: 'Papel',
        options: paperTypeOptions(),
        changeFn: (item) => this.onPaperTypeChange(item),
      },
      {
        type: 'select',
        name: 'impresoId',
        label: 'Tamaño',
        optionsFn: (item) => this.getImpresoOptionsFor(item.paperType),
        changeFn: (item) => this.onImpresoChange(item),
      },
      {
        type: 'dimensions',
        label: 'Medida',
        widthName: 'widthCm',
        lengthName: 'lengthCm',
        min: 0.1,
        step: 0.1,
        readonlyText: (item) => this.catalogMeasure(item),
        changeFn: (item) => this.onDimensionsChange(item),
      },
      {
        type: 'input',
        name: 'quantity',
        label: 'Cant.',
        inputType: 'number',
        min: 1,
        step: 1,
      },
    ],
  };

  ngOnInit(): void {
    this.impresosService
      .getImpresos()
      .pipe(takeUntil(this.destroy$))
      .subscribe((items) => {
        this.impresos = items;
        this.cdr.markForCheck();
      });

    this.settingsFacade
      .watchGeneralSettings()
      .pipe(takeUntil(this.destroy$))
      .subscribe((settings) => {
        this.generalSettings = settings;
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  writeValue(value: EstampadoPrintSpec[] | null): void {
    this.initialValue = value?.map((print) => ({
      ...print,
      impresoId: print.impresoId || '',
      quantity: printQuantity(print),
    })) ?? value;
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (value: EstampadoPrintSpec[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.locked = isDisabled;
    this.cdr.markForCheck();
  }

  onListChange(value: EstampadoPrintSpec[]): void {
    this.onChange(
      value.map((print) => ({
        ...print,
        impresoId: print.impresoId?.trim() || undefined,
        quantity: printQuantity(print),
      })),
    );
    this.onTouched();
  }

  private paperCost(print: EstampadoPrintSpec): number {
    if (!this.generalSettings) return 0;
    const dims = resolvePrintDimensions(print, (id) =>
      this.impresos.find((item) => item.id === id),
    );
    if (!dims) return 0;
    return (
      this.costService.calculateImpresoPaperCost(
        this.generalSettings,
        dims.paperType,
        dims.widthCm,
        dims.heightCm,
      ) * printQuantity(print)
    );
  }

  private catalogMeasure(print: EstampadoPrintSpec): string | null {
    if (!print.impresoId) return null;
    const dims = resolvePrintDimensions(print, (id) =>
      this.impresos.find((item) => item.id === id),
    );
    if (!dims) return null;
    return formatPrintDimensionsCm(dims.widthCm, undefined, dims.heightCm).replace(
      /\./g,
      ',',
    );
  }

  private printsSummary(items: EstampadoPrintSpec[]): string {
    const groups = summarizeEstampadoPrintQuantities(items, (id) =>
      this.impresos.find((item) => item.id === id),
    );
    const grouped = groups
      .map((group) => {
        const typeLabel = PAPER_TYPE_LABELS[group.paperType] ?? group.paperType;
        const size = formatPrintDimensionsCm(group.widthCm, undefined, group.heightCm);
        return `${typeLabel} ${size} ×${group.quantity}`;
      })
      .join(' · ');
    const total = items.reduce((sum, print) => sum + this.paperCost(print), 0);
    if (!grouped) {
      return `Papel ${this.money(total)}`;
    }
    return `${grouped} · Papel ${this.money(total)}`;
  }

  private money(value: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(value);
  }

  private getImpresoOptionsFor(paperType: PaperType): DbSelectOption[] {
    return [
      { value: '', label: 'Medida libre' },
      ...this.impresos
        .filter((item) => item.paperType === paperType)
        .map((item) => ({
          value: item.id,
          label: item.name,
        })),
    ];
  }

  private onPaperTypeChange(print: EstampadoPrintSpec): void {
    if (
      print.impresoId &&
      !this.getImpresoOptionsFor(print.paperType).some(
        (option) => option.value === print.impresoId,
      )
    ) {
      print.impresoId = '';
    }
  }

  private onImpresoChange(print: EstampadoPrintSpec): void {
    if (print.impresoId) {
      Object.assign(print, syncEstampadoPrintFromImpreso(print, this.impresos));
    }
  }

  private onDimensionsChange(print: EstampadoPrintSpec): void {
    if (!print.impresoId) {
      return;
    }

    const impreso = this.impresos.find((item) => item.id === print.impresoId);
    if (!impreso) {
      print.impresoId = '';
      return;
    }

    const impresoLength =
      impreso.lengthCm && impreso.lengthCm > 0
        ? impreso.lengthCm
        : impreso.heightCm;
    const printLength = Number(print.lengthCm) || 0;

    const matches =
      Number(print.widthCm) === impreso.widthCm &&
      printLength === impresoLength;

    if (!matches) {
      print.impresoId = '';
    }
  }
}
