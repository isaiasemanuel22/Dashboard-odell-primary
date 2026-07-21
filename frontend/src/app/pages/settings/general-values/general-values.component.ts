import {
  Component,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin, Subscription } from 'rxjs';
import {
  GeneralSettings,
  MachineProfile,
  MachineProfileRole,
  ProductType,
  Supply,
} from '../../../core/models';
import { SettingsService, SuppliesService } from '../../../core/services/settings.service';
import {
  DbButtonComponent,
  DbFormComponent,
  DbFormGridComponent,
  DbInputComponent,
  DbSelectComponent,
  DbSelectOption,
  DbStateMessageComponent,
} from '@general-components';
import { productTypeOptions } from '../../../shared/utils/select-options';

@Component({
  selector: 'app-general-values',
  standalone: true,
  imports: [
    FormsModule,
    DbFormComponent,
    DbFormGridComponent,
    DbInputComponent,
    DbSelectComponent,
    DbButtonComponent,
    DbStateMessageComponent,
  ],
  templateUrl: './general-values.component.html',
  styleUrl: './general-values.component.scss',
})
export class GeneralValuesComponent implements OnInit, OnDestroy {
  private readonly settingsService = inject(SettingsService);
  private readonly suppliesService = inject(SuppliesService);
  private settingsSub?: Subscription;

  settings: GeneralSettings | null = null;
  supplies: Supply[] = [];
  saving = false;
  savingProfiles = false;
  message = '';

  readonly roleOptions: DbSelectOption[] = [
    { value: MachineProfileRole.PRINT, label: 'Impresión' },
    { value: MachineProfileRole.WASH, label: 'Lavado' },
    { value: MachineProfileRole.CURE, label: 'Curado' },
    { value: MachineProfileRole.PRESS, label: 'Plancha' },
  ];

  readonly productTypeOptions = productTypeOptions();

  readonly productTypeSelectOptions: DbSelectOption[] = [
    { value: '', label: 'Todos' },
    ...productTypeOptions(),
  ];

  readonly roleLabels: Record<MachineProfileRole, string> = {
    [MachineProfileRole.PRINT]: 'Impresión',
    [MachineProfileRole.WASH]: 'Lavado',
    [MachineProfileRole.CURE]: 'Curado',
    [MachineProfileRole.PRESS]: 'Plancha',
  };

  ngOnInit(): void {
    this.settingsSub = this.settingsService.watchGeneralSettings().subscribe((settings) => {
      if (!settings || this.saving || this.savingProfiles) return;
      this.settings = structuredClone(settings);
      this.settings.errorMarginPercent ??= 0;
    });
    this.settingsService.getGeneralSettings(false).subscribe();
    this.suppliesService.getSupplies().subscribe((items) => {
      this.supplies = items;
    });
  }

  ngOnDestroy(): void {
    this.settingsSub?.unsubscribe();
  }

  get supplyOptions(): DbSelectOption[] {
    return [
      { value: '', label: '— Sin insumo —' },
      ...this.supplies.map((supply) => ({
        value: supply.id,
        label: `${supply.name} ($${supply.unitPrice}/${supply.unit})`,
      })),
    ];
  }

  saveGeneral(): void {
    if (!this.settings) return;
    this.saving = true;
    this.message = '';
    this.settingsService
      .updateCoreValues({
        electricityCostPerKwh: this.settings.electricityCostPerKwh,
        laborCostPerHour: this.settings.laborCostPerHour,
        errorMarginPercent: this.settings.errorMarginPercent,
      })
      .subscribe({
        next: (values) => {
          if (this.settings) {
            this.settings = {
              ...this.settings,
              ...values,
            };
          }
          this.saving = false;
          this.message = 'Valores guardados correctamente';
        },
        error: () => {
          this.saving = false;
          this.message = 'Error al guardar';
        },
      });
  }

  saveMachineProfiles(): void {
    if (!this.settings) return;

    const profiles = this.settings.machineProfiles.filter((profile) =>
      profile.name.trim(),
    );
    if (profiles.length === 0) {
      this.message = 'Agregá al menos un perfil con nombre';
      return;
    }

    this.savingProfiles = true;
    this.message = '';

    const requests = profiles.map((profile) => {
      const payload = this.toMachineProfilePayload(profile);
      if (this.isTemporaryProfile(profile.id)) {
        return this.settingsService.addMachineProfile(payload);
      }
      return this.settingsService.updateMachineProfile(profile.id, payload);
    });

    forkJoin(requests).subscribe({
      next: (savedProfiles) => {
        if (this.settings) {
          const savedIds = new Set(savedProfiles.map((profile) => profile.id));
          const untouched = this.settings.machineProfiles.filter(
            (profile) =>
              !profile.name.trim() && !savedIds.has(profile.id),
          );
          this.settings = {
            ...this.settings,
            machineProfiles: [...savedProfiles, ...untouched],
          };
        }
        this.savingProfiles = false;
        this.message = 'Perfiles de máquina guardados';
      },
      error: () => {
        this.savingProfiles = false;
        this.message = 'Error al guardar perfiles';
      },
    });
  }

  addMachineProfile(): void {
    if (!this.settings) return;
    this.settings.machineProfiles = [
      ...this.settings.machineProfiles,
      {
        id: `tmp-mp-${Date.now()}`,
        name: '',
        role: MachineProfileRole.PRINT,
        watts: 0,
        costPerHour: 0,
      },
    ];
  }

  removeMachineProfile(id: string): void {
    if (!this.settings) return;
    if (!confirm('¿Eliminar este perfil de máquina?')) return;

    if (this.isTemporaryProfile(id)) {
      this.settings.machineProfiles = this.settings.machineProfiles.filter(
        (profile) => profile.id !== id,
      );
      return;
    }

    this.settingsService.deleteMachineProfile(id).subscribe({
      next: () => {
        if (!this.settings) return;
        this.settings.machineProfiles = this.settings.machineProfiles.filter(
          (profile) => profile.id !== id,
        );
        this.message = 'Perfil eliminado';
      },
      error: () => {
        this.message = 'Error al eliminar perfil';
      },
    });
  }

  isWash(profile: MachineProfile): boolean {
    return profile.role === MachineProfileRole.WASH;
  }

  onRoleChange(profile: MachineProfile): void {
    if (
      profile.role === MachineProfileRole.WASH &&
      (profile.washBathUses === undefined || profile.washBathUses === null)
    ) {
      profile.washBathUses = 10;
    }
  }

  productTypeValue(profile: MachineProfile): string {
    return profile.productType ?? '';
  }

  setProductType(profile: MachineProfile, value: string): void {
    profile.productType = value ? (value as ProductType) : undefined;
  }

  productTypeLabel(profile: MachineProfile): string | null {
    if (!profile.productType) return 'Todos';
    return (
      this.productTypeOptions.find((option) => option.value === profile.productType)
        ?.label ?? profile.productType
    );
  }

  private isTemporaryProfile(id: string): boolean {
    return id.startsWith('tmp-mp-');
  }

  private toMachineProfilePayload(
    profile: MachineProfile,
  ): Omit<MachineProfile, 'id'> {
    return {
      name: profile.name.trim(),
      role: profile.role,
      watts: profile.watts,
      costPerHour: profile.costPerHour,
      productType: profile.productType,
      washSupplyId: profile.washSupplyId,
      consumptionMl: profile.consumptionMl,
      washBathUses: profile.washBathUses,
    };
  }
}
