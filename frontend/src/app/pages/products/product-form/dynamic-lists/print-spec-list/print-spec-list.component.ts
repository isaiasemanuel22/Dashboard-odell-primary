import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
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
} from '../../../../../core/models';
import { ImpresosService } from '../../../../../core/services/impresos.service';
import { ProductCostCalculationService } from '../../../../../core/services/product-cost-calculation.service';
import { paperTypeOptions } from '../../../../../shared/utils/select-options';
import {
  createEmptyEstampadoPrint,
  resolvePrintDimensions,
  syncEstampadoPrintFromImpreso,
} from '../../../../../shared/utils/estampado.helpers';
import { SettingsFacade } from '../../../../../store/settings/settings.facade';
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
      'Elegí un tamaño del catálogo y la medida se completa sola; con "Medida libre" la cargás vos.',
    layout: 'table',
    addPlacement: 'inside',
    tableColumns:
      'minmax(6.5rem, 0.9fr) minmax(6.25rem, 0.7fr) minmax(9rem, 1.25fr) minmax(9rem, 1fr) 4.75rem 2rem',
    itemLabel: (index) => `Impreso ${index + 1}`,
    addButtonLabel: '+ Agregar impreso',
    emptyMessage: 'Sin impresos configurados',
    totalValueFn: (items) => {
      const total = items.reduce((sum, print) => sum + this.paperCost(print), 0);
      return `Papel ${this.money(total)}`;
    },
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
        label: 'Medida (cm)',
        widthName: 'widthCm',
        lengthName: 'lengthCm',
        min: 0.1,
        step: 0.1,
        changeFn: (item) => this.onDimensionsChange(item),
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
    })) ?? value;
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (value: EstampadoPrintSpec[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(_isDisabled: boolean): void {
    this.cdr.markForCheck();
  }

  onListChange(value: EstampadoPrintSpec[]): void {
    this.onChange(
      value.map((print) => ({
        ...print,
        impresoId: print.impresoId?.trim() || undefined,
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
    return this.costService.calculateImpresoPaperCost(
      this.generalSettings,
      dims.paperType,
      dims.widthCm,
      dims.heightCm,
    );
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
