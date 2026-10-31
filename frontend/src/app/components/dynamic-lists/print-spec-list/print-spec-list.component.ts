import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnDestroy,
  OnInit,
  forwardRef,
  inject, DestroyRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { EstampadoPrintSpec } from '../../../core/models';
import { ImpresosService } from '../../../core/services/impresos.service';
import { ProductCostCalculationService } from '../../../core/services/product-cost-calculation.service';
import { printQuantity } from '../../../shared/utils/estampado.helpers';
import { SettingsFacade } from '../../../store/settings/settings.facade';
import { Subject, takeUntil } from 'rxjs';
import { DynamicListComponent } from '../dynamic-list/dynamic-list.component';
import { PrintSpecListLogic } from './print-spec-list.logic';

@Component({
  selector: 'app-print-spec-list',
  standalone: true,
  imports: [DynamicListComponent],
  template: `
    <app-dynamic-list
      [initialValue]="initialValue"
      [config]="logic.config"
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
  private readonly destroyRef = inject(DestroyRef);
  private readonly settingsFacade = inject(SettingsFacade);
  private readonly costService = inject(ProductCostCalculationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();
  private onChange: (value: EstampadoPrintSpec[]) => void = () => {};
  private onTouched: () => void = () => {};

  readonly logic = new PrintSpecListLogic(this.costService);

  ngOnInit(): void {
    this.impresosService
      .getImpresos()
      .pipe(takeUntil(this.destroy$))
      .subscribe((items) => {
        this.logic.impresos = items;
        this.cdr.markForCheck();
      });

    this.settingsFacade
      .watchUntilDestroyed(this.destroyRef)
      .subscribe((settings) => {
        this.logic.generalSettings = settings;
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
}
