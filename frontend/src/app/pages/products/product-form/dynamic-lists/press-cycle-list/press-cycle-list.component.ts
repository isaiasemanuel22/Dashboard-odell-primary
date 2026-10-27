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
import { Subject, takeUntil } from 'rxjs';
import {
  EstampadoPressCycle,
  GeneralSettings,
  MachineProfileRole,
  ProductType,
} from '../../../../../core/models';
import {
  createEmptyEstampadoPressCycle,
  totalEstampadoPressMinutes,
} from '../../../../../shared/utils/estampado.helpers';
import {
  calculateMachineOverhead,
  getMachineProfilesForProductType,
} from '../../../../../shared/utils/machine-profile.util';
import { SettingsFacade } from '../../../../../store/settings/settings.facade';
import { ProductFormGroup } from '../../services/product-form-state-manager.service';
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
  @Input({ required: true }) productForm!: ProductFormGroup;

  initialValue: EstampadoPressCycle[] | null = null;

  private readonly settingsFacade = inject(SettingsFacade);
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
      return `Total ${this.minutesLabel(minutes)} · Plancha ${this.money(this.pressCost(minutes))}`;
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

  copyLocations(): void {
    const prints = this.productForm.controls.prints.value ?? [];
    if (!prints.length) return;

    const cycles = [...(this.productForm.controls.pressCycles.value ?? [])];
    const next = prints.map((print, index) => {
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

  private pressCost(minutes: number): number {
    if (!this.generalSettings) return 0;
    const overhead = calculateMachineOverhead(
      this.generalSettings,
      ProductType.ESTAMPADO,
      { printTimeHours: 0, pressMinutes: minutes },
    );
    return overhead.energyCost + overhead.machineCost;
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
