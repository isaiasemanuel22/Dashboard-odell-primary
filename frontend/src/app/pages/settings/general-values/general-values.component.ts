import {
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
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
export class GeneralValuesComponent implements OnInit {
  private readonly settingsService = inject(SettingsService);
  private readonly suppliesService = inject(SuppliesService);

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
    this.loadSettings();
    this.suppliesService.getSupplies().subscribe((items) => {
      this.supplies = items;
    });
  }

  loadSettings(): void {
    this.settingsService.getGeneralSettings().subscribe((s) => {
      this.settings = structuredClone(s);
      this.settings.errorMarginPercent ??= 0;
    });
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
      .updateGeneralSettings({
        electricityCostPerKwh: this.settings.electricityCostPerKwh,
        laborCostPerHour: this.settings.laborCostPerHour,
        errorMarginPercent: this.settings.errorMarginPercent,
      })
      .subscribe({
        next: (s) => {
          this.settings = structuredClone(s);
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
    this.savingProfiles = true;
    this.message = '';
    this.settingsService
      .updateGeneralSettings({
        machineProfiles: this.settings.machineProfiles.filter((profile) =>
          profile.name.trim(),
        ),
      })
      .subscribe({
        next: (s) => {
          this.settings = structuredClone(s);
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
        id: `mp-${Date.now()}`,
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
    this.settings.machineProfiles = this.settings.machineProfiles.filter(
      (profile) => profile.id !== id,
    );
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
}
