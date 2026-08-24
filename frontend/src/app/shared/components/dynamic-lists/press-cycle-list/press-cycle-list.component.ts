import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  forwardRef,
  inject,
} from '@angular/core';
import {
  ControlValueAccessor,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';
import { EstampadoPressCycle } from '../../../../core/models';
import { createEmptyEstampadoPressCycle } from '../../../utils/estampado.helpers';
import {
  DynamicListComponent,
  DynamicListConfig,
} from '../dynamic-list/dynamic-list.component';

@Component({
  selector: 'app-press-cycle-list',
  standalone: true,
  imports: [DynamicListComponent],
  template: `
    <app-dynamic-list
      [initialValue]="initialValue"
      [config]="cycleConfig"
      (valueChange)="onListChange($event)"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PressCycleListComponent),
      multi: true,
    },
  ],
})
export class PressCycleListComponent implements ControlValueAccessor {
  initialValue: EstampadoPressCycle[] | null = null;

  private readonly cdr = inject(ChangeDetectorRef);
  private onChange: (value: EstampadoPressCycle[]) => void = () => {};
  private onTouched: () => void = () => {};

  readonly cycleConfig: DynamicListConfig = {
    legend: 'Bajadas de plancha',
    description:
      'Cada bajada es un ciclo de plancha con su duración y cantidad de repeticiones.',
    itemLabel: (index) => `Bajada ${index + 1}`,
    addButtonLabel: '+ Agregar bajada',
    emptyMessage: 'Sin bajadas configuradas',
    minItems: 1,
    createItem: () => createEmptyEstampadoPressCycle(),
    showRemoveButton: (items) => items.length > 1,
    fields: [
      {
        type: 'input',
        name: 'label',
        label: 'Etiqueta (opcional)',
        placeholder: 'Ej: Frente, Espalda',
      },
      {
        type: 'input',
        name: 'pressMinutes',
        label: 'Minutos por bajada',
        inputType: 'number',
        min: 0,
        step: 0.5,
      },
      {
        type: 'input',
        name: 'bajadas',
        label: 'Cantidad de bajadas',
        inputType: 'number',
        min: 1,
        step: 1,
      },
    ],
  };

  writeValue(value: EstampadoPressCycle[] | null): void {
    this.initialValue = value;
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (value: EstampadoPressCycle[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(_isDisabled: boolean): void {
    this.cdr.markForCheck();
  }

  onListChange(value: EstampadoPressCycle[]): void {
    this.onChange(value);
    this.onTouched();
  }
}
