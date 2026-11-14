import {
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { shortId, sortAndDisambiguateOptions } from '../../../shared/utils/search-text.util';
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
import { BreakpointService } from '../../../core/services/breakpoint.service';
import {
  DbButtonComponent,
  DbCheckboxComponent,
  DbFormComponent,
  DbInputComponent,
  DbPillGroupComponent,
  DbSelectOption,
  DbStateMessageComponent,
  MobileSettingsPageComponent,
  MobileFieldGroupComponent,
  MobileCatalogRowComponent,
  MobileSheetComponent,
  DB_DATA_TABLE,
  OdlActionEvent,
  OdlColumn,
  OdlRowAction,
} from '@general-components';
import { MobileDockAction } from '../../../components/mobile-dock/mobile-dock.component';
import { productTypeOptions } from '../../../shared/utils/select-options';
import {
  SettingsUnsavedChanges,
  settingsSnapshot,
} from '../settings-unsaved-changes';
import { GeneralValuesProfileEditorComponent } from './general-values-profile-editor/general-values-profile-editor.component';
import {
  mergeMachineProfilesPreservingDirty,
  selectDirtyMachineProfilesForSave,
} from './machine-profiles-dirty.util';

@Component({
  selector: 'app-general-values',
  standalone: true,
  imports: [
    FormsModule,
    DbFormComponent,
    DbInputComponent,
    DbCheckboxComponent,
    DbButtonComponent,
    DbPillGroupComponent,
    DbStateMessageComponent,
    MobileSettingsPageComponent,
    MobileFieldGroupComponent,
    MobileCatalogRowComponent,
    MobileSheetComponent,
    ...DB_DATA_TABLE,
    GeneralValuesProfileEditorComponent,
  ],
  templateUrl: './general-values.component.html',
  styleUrl: './general-values.component.scss',
})
export class GeneralValuesComponent
  implements OnInit, OnDestroy, SettingsUnsavedChanges
{
  readonly profileActions: OdlRowAction<MachineProfile>[] = [
    { id: 'editar', label: 'Editar' },
    { id: 'eliminar', label: 'Eliminar', danger: true },
  ];

  readonly profileColumns: OdlColumn<MachineProfile>[] = [
    {
      key: 'name',
      header: 'Equipo',
      type: 'custom',
      value: (profile) => profile.name.trim() || 'Nuevo equipo',
      secondary: (profile) => this.supplyCaption(profile),
    },
    { key: 'role', header: 'Rol', value: (profile) => this.roleLabels[profile.role] },
    { key: 'productType', header: 'Tipo de producto', value: (profile) => this.productTypeLabel(profile) },
    { key: 'watts', header: 'Consumo', value: (profile) => `${profile.watts} W` },
    { key: 'costPerHour', header: 'Costo máquina', type: 'money', secondary: () => '/ h' },
  ];

  profileQueueBadges(profile: MachineProfile): { label: string; tone: string }[] {
    const badges: { label: string; tone: string }[] = [];
    if (profile.queueEnabled) {
      badges.push({ label: 'En cola', tone: 'info' });
    }
    if (profile.costBase) {
      badges.push({ label: 'Costos', tone: 'ok' });
    }
    return badges;
  }

  onProfileAction(event: OdlActionEvent<MachineProfile>): void {
    if (event.actionId === 'editar') this.selectProfile(event.row.id);
    if (event.actionId === 'eliminar') this.removeMachineProfile(event.row.id);
  }

  private readonly settingsService = inject(SettingsService);
  private readonly suppliesService = inject(SuppliesService);
  private readonly realtime = inject(RealtimeService);
  private readonly breakpoint = inject(BreakpointService);
  private readonly destroyRef = inject(DestroyRef);
  private settingsSub?: Subscription;

  readonly isMobile = this.breakpoint.isMobile;

  settings: GeneralSettings | null = null;
  supplies: Supply[] = [];
  saving = false;
  savingProfiles = false;
  message = '';
  realtimeSyncEnabled = false;
  profileTypeFilter: 'all' | ProductType = 'all';
  selectedProfileId: string | null = null;
  openMenuId: string | null = null;
  private savedCoreSnapshot = '';
  /** Perfiles tal como vinieron del store (última emisión). */
  private profilesSnapshot: MachineProfile[] = [];
  /** Ids con ediciones locales aún no guardadas. */
  private dirtyProfileIds = new Set<string>();

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
      const incoming = structuredClone(settings);
      incoming.errorMarginPercent ??= 0;
      this.profilesSnapshot = structuredClone(incoming.machineProfiles);

      if (this.settings && this.dirtyProfileIds.size > 0) {
        this.settings = {
          ...incoming,
          machineProfiles: mergeMachineProfilesPreservingDirty(
            incoming.machineProfiles,
            this.settings.machineProfiles,
            this.dirtyProfileIds,
          ),
        };
      } else {
        this.settings = incoming;
      }
      this.captureCoreBaseline();
    });
    this.settingsService.getGeneralSettings(false).subscribe();
    this.suppliesService
      .watchSupplies()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((items) => {
        this.supplies = items;
      });
  }

  hasUnsavedChanges(): boolean {
    if (!this.settings) return false;
    if (this.dirtyProfileIds.size > 0) return true;
    if (this.selectedProfileId) return true;
    return this.coreSnapshot() !== this.savedCoreSnapshot;
  }

  private captureCoreBaseline(): void {
    this.savedCoreSnapshot = this.coreSnapshot();
  }

  private coreSnapshot(): string {
    if (!this.settings) return '';
    return settingsSnapshot({
      electricityCostPerKwh: this.settings.electricityCostPerKwh,
      laborCostPerHour: this.settings.laborCostPerHour,
      modelingRatePerHour: this.settings.modelingRatePerHour,
      graphicDesignRatePerHour: this.settings.graphicDesignRatePerHour,
      errorMarginPercent: this.settings.errorMarginPercent,
    });
  }

  ngOnDestroy(): void {
    this.settingsSub?.unsubscribe();
  }

  ratesMissing(): boolean {
    return this.missingRates().length > 0;
  }

  ratesMissingText(): string {
    const m = this.missingRates();
    return m.length === 1
      ? `La tarifa de ${m[0]} está sin definir.`
      : `Las tarifas de ${m.join(' y ')} están sin definir.`;
  }

  private missingRates(): string[] {
    const missing: string[] = [];
    if (!this.settings?.modelingRatePerHour) missing.push('modelado');
    if (!this.settings?.graphicDesignRatePerHour) {
      missing.push('diseño gráfico');
    }
    return missing;
  }

  get supplyOptions(): DbSelectOption[] {
    return [
      { value: '', label: '— Sin insumo —' },
      ...sortAndDisambiguateOptions(
        this.supplies.map((supply) => ({
          value: supply.id,
          label: `${supply.name} ($${supply.unitPrice}/${supply.unit})`,
        })),
        (o) => shortId(o.value),
      ),
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
    if (!this.isMobile()) {
      Promise.resolve().then(() => {
        requestAnimationFrame(() => {
          document
            .getElementById('machine-profile-editor')
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });
    }
  }

  closeProfileEditor(): void {
    this.discardSelectedProfileEdits();
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

  get mobileDockActions(): MobileDockAction[] {
    return [
      {
        id: 'save',
        label: this.saving
          ? 'Guardando…'
          : 'Guardar y recalcular precios',
        kind: 'primary',
        disabled: this.saving,
      },
    ];
  }

  onMobileDockAction(id: string): void {
    if (id === 'save') {
      this.saveGeneral();
    }
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
          this.captureCoreBaseline();
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

    const profiles = selectDirtyMachineProfilesForSave(
      this.settings.machineProfiles,
      this.dirtyProfileIds,
    );
    if (profiles.length === 0) {
      this.message =
        this.dirtyProfileIds.size > 0
          ? 'Agregá un nombre al perfil antes de guardar'
          : 'No hay cambios de perfiles para guardar';
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
          let nextProfiles = [...this.settings.machineProfiles];
          profiles.forEach((oldProfile, index) => {
            const saved = savedProfiles[index];
            const idx = nextProfiles.findIndex((p) => p.id === oldProfile.id);
            if (idx >= 0) {
              nextProfiles[idx] = saved;
            }
            this.dirtyProfileIds.delete(oldProfile.id);
            if (this.selectedProfileId === oldProfile.id) {
              this.selectedProfileId = saved.id;
            }
          });
          this.settings = {
            ...this.settings,
            machineProfiles: nextProfiles,
          };
          // Snapshot = perfiles ya persistidos (sin dirty restantes).
          this.profilesSnapshot = structuredClone(
            nextProfiles.filter((p) => !this.dirtyProfileIds.has(p.id)),
          );
        }
        this.savingProfiles = false;
        this.message = 'Perfiles de máquina guardados';
        if (
          this.selectedProfileId &&
          !this.settings?.machineProfiles.some(
            (profile) => profile.id === this.selectedProfileId,
          )
        ) {
          this.selectedProfileId = null;
        }
        this.scrollToSettingsMessage();
      },
      error: () => {
        this.savingProfiles = false;
        this.message = 'Error al guardar perfiles';
        this.scrollToSettingsMessage();
      },
    });
  }

  /** Lleva al aviso de confirmación de Ajustes (mismo patrón que el resto). */
  private scrollToSettingsMessage(): void {
    if (this.isMobile()) return;
    Promise.resolve().then(() => {
      requestAnimationFrame(() => {
        document
          .querySelector('.values-page > .message')
          ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    });
  }

  addMachineProfile(): void {
    if (!this.settings) return;
    const id = `tmp-mp-${Date.now()}`;
    this.settings.machineProfiles = [
      ...this.settings.machineProfiles,
      {
        id,
        name: '',
        role: MachineProfileRole.PRINT,
        watts: 0,
        costPerHour: 0,
      },
    ];
    this.dirtyProfileIds.add(id);
    this.selectedProfileId = id;
  }

  removeMachineProfile(id: string): void {
    if (!this.settings) return;
    if (!confirm('¿Eliminar este perfil de máquina?')) return;

    if (this.selectedProfileId === id) this.selectedProfileId = null;
    this.dirtyProfileIds.delete(id);
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
        this.profilesSnapshot = this.profilesSnapshot.filter(
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

  machineRowCaption(profile: MachineProfile): string {
    const role = this.roleLabels[profile.role];
    const watts = `${profile.watts || 0} W`;
    if (profile.costPerHour) {
      const money = new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        maximumFractionDigits: 0,
      }).format(profile.costPerHour);
      return `${role} · ${watts} · ${money} / h`;
    }
    return `${role} · ${watts}`;
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

  onProfileChange(updated: MachineProfile): void {
    if (!this.settings) return;
    this.dirtyProfileIds.add(updated.id);
    this.settings = {
      ...this.settings,
      machineProfiles: this.settings.machineProfiles.map((item) =>
        item.id === updated.id ? updated : item,
      ),
    };
  }

  onCostBaseChange(profile: MachineProfile, enabled: boolean): void {
    if (!this.settings) return;
    this.dirtyProfileIds.add(profile.id);
    this.settings = {
      ...this.settings,
      machineProfiles: this.settings.machineProfiles.map((item) => {
        if (item.id === profile.id) {
          return { ...item, costBase: enabled };
        }
        if (
          enabled &&
          item.role === MachineProfileRole.PRINT &&
          item.productType === profile.productType &&
          item.costBase
        ) {
          this.dirtyProfileIds.add(item.id);
          return { ...item, costBase: false };
        }
        return item;
      }),
    };
  }

  /** Al cancelar: restaurar el perfil seleccionado desde el snapshot del store. */
  private discardSelectedProfileEdits(): void {
    if (!this.settings || !this.selectedProfileId) return;
    const id = this.selectedProfileId;
    if (!this.dirtyProfileIds.has(id)) return;

    const snap = this.profilesSnapshot.find((profile) => profile.id === id);
    if (snap) {
      this.settings = {
        ...this.settings,
        machineProfiles: this.settings.machineProfiles.map((profile) =>
          profile.id === id ? structuredClone(snap) : profile,
        ),
      };
    } else {
      this.settings = {
        ...this.settings,
        machineProfiles: this.settings.machineProfiles.filter(
          (profile) => profile.id !== id,
        ),
      };
    }
    this.dirtyProfileIds.delete(id);
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
      queueEnabled: profile.queueEnabled,
      workHoursPerDay: profile.workHoursPerDay,
      workWeekdays: profile.workWeekdays,
      workStartHour: profile.workStartHour,
      amsType: profile.amsType,
      amsSlots: profile.amsSlots,
      costBase: profile.costBase,
    };
  }
}
