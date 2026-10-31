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
  EstampadoPressCycle,
  EstampadoPrintSpec,
  GeneralSettings,
  MachineProfileRole,
  ProductType,
} from '../../../core/models';
import {
  createEmptyEstampadoPressCycle,
  totalEstampadoPressMinutes,
} from '../../../shared/utils/estampado.helpers';
import {
  calculateMachineOverhead,
  getMachineProfilesForProductType,
} from '../../../shared/utils/machine-profile.util';
import { SettingsFacade } from '../../../store/settings/settings.facade';
import { ProductFormGroup } from '../../../pages/products/product-form/services/product-form-state-manager.service';
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
      [embedded]="embedded"
      [locked]="locked"
      (valueChange)="onListChange($event)"
      (footerAction)="copyLocations()"
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
export class PressCycleListComponent
  implements OnInit, OnDestroy, ControlValueAccessor
{
  @Input() embedded = false;
  @Input() locked = false;
  /** Opcional: en presupuesto personalizado no hay form de producto. */
  @Input() productForm?: ProductFormGroup;
  /** Fuente de ubicaciones cuando no hay productForm (p. ej. presupuesto). */
  @Input() prints: EstampadoPrintSpec[] = [];

  initialValue: EstampadoPressCycle[] | null = null;

  private readonly settingsFacade = inject(SettingsFacade);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();
  private generalSettings: GeneralSettings | null = null;
  private onChange: (value: EstampadoPressCycle[]) => void = () => {};
  private onTouched: () => void = () => {};

  readonly cycleConfig: DynamicListConfig = {
    legend: 'Bajadas de plancha',
    description: 'Cada bajada es un ciclo de plancha con su duración',
    headerAside: () => this.pressAside(),
    footerActionLabel: 'Copiar ubicaciones desde impresos',
    layout: 'table',
    addPlacement: 'inside',
    tableColumns: 'minmax(8rem, 1.5fr) 8.75rem 7.25rem 4.75rem 2rem',
    itemLabel: (index) => `Bajada ${index + 1}`,
    addButtonLabel: '+ Agregar bajada',
    emptyMessage: 'Sin bajadas configuradas',
    totalValueFn: (items) => {
      const minutes = totalEstampadoPressMinutes(items);
      const overhead = this.pressOverhead(minutes);
      return `Total ${this.minutesLabel(minutes)} · luz ${this.money(overhead.energyCost)} + máquina ${this.money(overhead.machineCost)}`;
    },
    displayColumns: [
      {
        label: 'Tiempo',
        render: (item) => ({
          text: this.minutesLabel(this.cycleMinutes(item)),
          tone: 'strong' as const,
        }),
      },
    ],
    minItems: 1,
    createItem: () => createEmptyEstampadoPressCycle(),
    showRemoveButton: (items) => items.length > 1,
    fields: [
      {
        type: 'input',
        name: 'label',
        label: 'Ubicación',
        placeholder: 'Ej.: Pecho',
      },
      {
        type: 'input',
        name: 'pressMinutes',
        label: 'Minutos por bajada',
        inputType: 'number',
        suffix: 'min',
        min: 0,
        step: 0.5,
      },
      {
        type: 'input',
        name: 'bajadas',
        label: 'Bajadas',
        inputType: 'number',
        min: 1,
        step: 1,
        control: 'stepper',
      },
    ],
  };

  ngOnInit(): void {
    this.settingsFacade
      .watchUntilDestroyed(this.destroyRef)
      .subscribe((settings) => {
        this.generalSettings = settings;
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

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

  setDisabledState(isDisabled: boolean): void {
    this.locked = isDisabled;
    this.cdr.markForCheck();
  }

  onListChange(value: EstampadoPressCycle[]): void {
    this.onChange(value);
    this.onTouched();
  }

  copyLocations(): void {
    const prints = this.productForm
      ? (this.productForm.controls.prints.value ?? [])
      : this.prints;
    if (!prints.length) return;

    const cycles = this.productForm
      ? [...(this.productForm.controls.pressCycles.value ?? [])]
      : [...(this.initialValue ?? [])];
    const next: EstampadoPressCycle[] = prints.map((print, index) => {
      const existing = cycles[index];
      const label = print.label?.trim() || undefined;
      if (existing) return { ...existing, label };
      return { ...createEmptyEstampadoPressCycle(), label };
    });
    if (cycles.length > prints.length) {
      next.push(...cycles.slice(prints.length));
    }

    this.initialValue = next;
    this.onChange(next);
    this.onTouched();
    this.cdr.markForCheck();
  }

  private cycleMinutes(cycle: EstampadoPressCycle): number {
    return (Number(cycle.pressMinutes) || 0) * (Number(cycle.bajadas) || 1);
  }

  private pressAside(): string {
    if (!this.generalSettings) return '';
    const profile = getMachineProfilesForProductType(
      this.generalSettings,
      ProductType.ESTAMPADO,
    ).find((item) => item.role === MachineProfileRole.PRESS);
    if (!profile) return '';
    return `${profile.name} · ${profile.watts} W`;
  }

  private pressOverhead(minutes: number): { energyCost: number; machineCost: number } {
    if (!this.generalSettings) return { energyCost: 0, machineCost: 0 };
    return calculateMachineOverhead(
      this.generalSettings,
      ProductType.ESTAMPADO,
      { printTimeHours: 0, pressMinutes: minutes },
    );
  }

  private minutesLabel(value: number): string {
    const text = new Intl.NumberFormat('es-AR', {
      maximumFractionDigits: 1,
    }).format(Number(value) || 0);
    return `${text} min`;
  }

  private money(value: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(value);
  }
}
