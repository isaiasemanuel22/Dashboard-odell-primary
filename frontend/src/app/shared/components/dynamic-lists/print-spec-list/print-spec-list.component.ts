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
  ImpresoWithCost,
  PaperType,
} from '../../../../core/models';
import { ImpresosService } from '../../../../core/services/impresos.service';
import { paperTypeOptions } from '../../../utils/select-options';
import {
  createEmptyEstampadoPrint,
  formatPrintDimensionsCm,
  syncEstampadoPrintFromImpreso,
} from '../../../utils/estampado.helpers';
import { DbSelectOption } from '@general-components';
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
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();
  private impresos: ImpresoWithCost[] = [];
  private onChange: (value: EstampadoPrintSpec[]) => void = () => {};
  private onTouched: () => void = () => {};

  readonly printConfig: DynamicListConfig = {
    legend: 'Impresos',
    description:
      'Agregá cada tamaño de papel o transfer que lleva el producto.',
    itemLabel: (index) => `Impreso ${index + 1}`,
    addButtonLabel: '+ Agregar impreso',
    emptyMessage: 'Sin impresos configurados',
    minItems: 1,
    createItem: () => createEmptyEstampadoPrint(),
    showRemoveButton: (items) => items.length > 1,
    fields: [
      {
        type: 'input',
        name: 'label',
        label: 'Etiqueta (opcional)',
        placeholder: 'Ej: Pecho, Espalda',
      },
      {
        type: 'select',
        name: 'paperType',
        label: 'Tipo de papel',
        options: paperTypeOptions(),
        changeFn: (item) => this.onPaperTypeChange(item),
      },
      {
        type: 'select',
        name: 'impresoId',
        label: 'Desde catálogo (opcional)',
        placeholder: 'Elegir tamaño del catálogo...',
        optionsFn: (item) => this.getImpresoOptionsFor(item.paperType),
        changeFn: (item) => this.onImpresoChange(item),
      },
      {
        type: 'dimensions',
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
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  writeValue(value: EstampadoPrintSpec[] | null): void {
    this.initialValue = value;
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
    this.onChange(value);
    this.onTouched();
  }

  private getImpresoOptionsFor(paperType: PaperType): DbSelectOption[] {
    return this.impresos
      .filter((item) => item.paperType === paperType)
      .map((item) => ({
        value: item.id,
        label: `${item.name} (${formatPrintDimensionsCm(
          item.widthCm,
          item.lengthCm && item.lengthCm > 0 ? item.lengthCm : item.heightCm,
        )})`,
      }));
  }

  private onPaperTypeChange(print: EstampadoPrintSpec): void {
    if (
      print.impresoId &&
      !this.getImpresoOptionsFor(print.paperType).some(
        (option) => option.value === print.impresoId,
      )
    ) {
      print.impresoId = undefined;
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
      print.impresoId = undefined;
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
      print.impresoId = undefined;
    }
  }
}
