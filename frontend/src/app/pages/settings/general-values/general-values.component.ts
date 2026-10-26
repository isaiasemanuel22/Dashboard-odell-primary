import {
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { RealtimeService } from '../../../core/services/realtime.service';
import {
  DbButtonComponent,
  DbCheckboxComponent,
  DbFormComponent,
  DbFormGridComponent,
  DbInputComponent,
  DbSelectComponent,
  DbSelectOption,
  DbStateMessageComponent,
  DB_DATA_TABLE,
  OdlActionEvent,
  OdlColumn,
  OdlRowAction,
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
    DbCheckboxComponent,
    DbButtonComponent,
    DbStateMessageComponent,
    ...DB_DATA_TABLE,
  ],
  templateUrl: './general-values.component.html',
  styleUrl: './general-values.component.scss',
})
export class GeneralValuesComponent implements OnInit, OnDestroy {
  readonly profileActions: OdlRowAction<MachineProfile>[] = [
    { id: 'editar', label: 'Editar' },
    { id: 'eliminar', label: 'Eliminar', danger: true },
  ];

  readonly profileColumns: OdlColumn<MachineProfile>[] = [
    {
      key: 'name',
      header: 'Equipo',
      type: 'primary',
      value: (profile) => profile.name.trim() || 'Nuevo equipo',
      secondary: (profile) => this.supplyCaption(profile),
    },
    { key: 'role', header: 'Rol', value: (profile) => this.roleLabels[profile.role] },
    { key: 'productType', header: 'Tipo de producto', value: (profile) => this.productTypeLabel(profile) },
    { key: 'watts', header: 'Consumo', value: (profile) => `${profile.watts} W` },
    { key: 'costPerHour', header: 'Costo máquina', type: 'money', secondary: () => '/ h' },
  ];

  onProfileAction(event: OdlActionEvent<MachineProfile>): void {
    if (event.actionId === 'editar') this.selectProfile(event.row.id);
    if (event.actionId === 'eliminar') this.removeMachineProfile(event.row.id);
  }

  private readonly settingsService = inject(SettingsService);
  private readonly suppliesService = inject(SuppliesService);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  private settingsSub?: Subscription;

  settings: GeneralSettings | null = null;
  supplies: Supply[] = [];
  saving = false;
  savingProfiles = false;
  message = '';
  realtimeSyncEnabled = false;
  profileTypeFilter: 'all' | ProductType = 'all';
  selectedProfileId: string | null = null;
  openMenuId: string | null = null;

  readonly profileFilters: { value: 'all' | ProductType; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: ProductType.FDM, label: 'FDM' },
    { value: ProductType.RESINA, label: 'Resina' },
    { value: ProductType.ESTAMPADO, label: 'Estampado' },
  ];

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
    this.realtimeSyncEnabled = this.realtime.isSyncEnabled();
    this.settingsSub = this.settingsService.watchGeneralSettings().subscribe((settings) => {
      if (!settings || this.saving || this.savingProfiles) return;
      this.settings = structuredClone(settings);
      this.settings.errorMarginPercent ??= 0;
    });
    this.settingsService.getGeneralSettings(false).subscribe();
    this.suppliesService
      .watchSupplies()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((items) => {
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

  get filteredProfiles(): MachineProfile[] {
    if (!this.settings) return [];
    if (this.profileTypeFilter === 'all') return this.settings.machineProfiles;
    return this.settings.machineProfiles.filter(
      (profile) => profile.productType === this.profileTypeFilter,
    );
  }

  get selectedProfile(): MachineProfile | null {
    if (!this.settings || !this.selectedProfileId) return null;
    return (
      this.settings.machineProfiles.find((profile) => profile.id === this.selectedProfileId) ??
      null
    );
  }

  selectProfile(id: string): void {
    this.openMenuId = null;
    this.selectedProfileId = id;
  }

  closeProfileEditor(): void {
    this.selectedProfileId = null;
  }

  toggleMenu(id: string): void {
    this.openMenuId = this.openMenuId === id ? null : id;
  }

  supplyCaption(profile: MachineProfile): string | null {
    if (!this.isWash(profile) || !profile.washSupplyId) return null;
    const supply = this.supplies.find((item) => item.id === profile.washSupplyId);
    if (!supply) return null;
    const ml = profile.consumptionMl ? `${profile.consumptionMl} ml por baño` : '';
    const uses = `${profile.washBathUses || 10} usos`;
    return [supply.name, ml, uses].filter(Boolean).join(' · ');
  }

  saveGeneral(): void {
    if (!this.settings) return;
    this.saving = true;
    this.message = '';
    this.settingsService
      .updateCoreValues({
        electricityCostPerKwh: this.settings.electricityCostPerKwh,
        laborCostPerHour: this.settings.laborCostPerHour,
        modelingRatePerHour: this.settings.modelingRatePerHour,
        graphicDesignRatePerHour: this.settings.graphicDesignRatePerHour,
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

  onRealtimeSyncChange(enabled: boolean): void {
    this.realtimeSyncEnabled = enabled;
    this.realtime.setSyncEnabled(enabled);
    this.message = enabled
      ? 'Sincronización automática activada en este navegador'
      : 'Sincronización automática desactivada en este navegador';
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
        if (
          this.selectedProfileId &&
          !this.settings?.machineProfiles.some((profile) => profile.id === this.selectedProfileId)
        ) {
          this.selectedProfileId = null;
        }
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
    this.selectedProfileId = this.settings.machineProfiles.at(-1)?.id ?? null;
  }

  removeMachineProfile(id: string): void {
    if (!this.settings) return;
    if (!confirm('¿Eliminar este perfil de máquina?')) return;

    if (this.selectedProfileId === id) this.selectedProfileId = null;
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
        if (this.selectedProfileId === id) this.selectedProfileId = null;
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
