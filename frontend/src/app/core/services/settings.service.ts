import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ColorConfig,
  FilamentPriceConfig,
  GeneralSettings,
  MachineCostConfig,
  MachineProfile,
  PaperPricesPerSqm,
  PowerConsumptionConfig,
  ResinPriceConfig,
  ServiceProfitMargins,
  Supply,
  SupplyCategory,
} from '../models';
import { SettingsFacade } from '../../store/settings/settings.facade';
import { SuppliesFacade } from '../../store/supplies/supplies.facade';
import { pricePerSqmFromReferenceSheet } from '../../shared/utils/paper-cost.util';

export interface CoreValuesSettings {
  electricityCostPerKwh: number;
  laborCostPerHour: number;
  errorMarginPercent: number;
}

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly baseUrl = `${environment.apiUrl}/settings`;
  private readonly http = inject(HttpClient);
  private readonly settingsFacade = inject(SettingsFacade);

  watchGeneralSettings(): Observable<GeneralSettings | null> {
    return this.settingsFacade.watchGeneralSettings();
  }

  peekGeneralSettings(): GeneralSettings | null {
    return this.settingsFacade.peekGeneralSettings();
  }

  getGeneralSettings(refresh = false): Observable<GeneralSettings> {
    return this.settingsFacade.ensureLoaded(refresh);
  }

  updateCoreValues(
    data: Partial<CoreValuesSettings>,
  ): Observable<CoreValuesSettings> {
    return this.http
      .patch<CoreValuesSettings>(`${this.baseUrl}/core-values`, data)
      .pipe(tap((values) => this.patchSettings(values)));
  }

  updateProfitMargins(
    profitMargins: ServiceProfitMargins,
  ): Observable<ServiceProfitMargins> {
    return this.http
      .patch<ServiceProfitMargins>(`${this.baseUrl}/profit-margins`, {
        profitMargins,
      })
      .pipe(
        tap((margins) =>
          this.patchSettings({
            profitMargins: margins,
          }),
        ),
      );
  }

  updatePaperReferenceSheets(
    paperReferenceSheets: GeneralSettings['paperReferenceSheets'],
  ): Observable<GeneralSettings['paperReferenceSheets']> {
    return this.http
      .patch<GeneralSettings['paperReferenceSheets']>(
        `${this.baseUrl}/paper-prices`,
        { paperReferenceSheets },
      )
      .pipe(
        tap((sheets) =>
          this.patchSettings({
            paperReferenceSheets: sheets,
            paperPricesPerSqm: {
              sublimacion: pricePerSqmFromReferenceSheet(sheets.sublimacion),
              dtf: pricePerSqmFromReferenceSheet(sheets.dtf),
              dtfUv: pricePerSqmFromReferenceSheet(sheets.dtfUv),
            },
          }),
        ),
      );
  }

  updatePaperPrices(
    paperPricesPerSqm: PaperPricesPerSqm,
  ): Observable<PaperPricesPerSqm> {
    return this.http
      .patch<PaperPricesPerSqm>(`${this.baseUrl}/paper-prices`, {
        paperPricesPerSqm,
      })
      .pipe(
        tap((prices) =>
          this.patchSettings({
            paperPricesPerSqm: prices,
          }),
        ),
      );
  }

  getMachineProfiles(): Observable<MachineProfile[]> {
    return this.http.get<MachineProfile[]>(`${this.baseUrl}/machine-profiles`);
  }

  addMachineProfile(
    data: Omit<MachineProfile, 'id'>,
  ): Observable<MachineProfile> {
    return this.http
      .post<MachineProfile>(`${this.baseUrl}/machine-profiles`, data)
      .pipe(tap((profile) => this.upsertMachineProfile(profile)));
  }

  updateMachineProfile(
    id: string,
    data: Partial<Omit<MachineProfile, 'id'>>,
  ): Observable<MachineProfile> {
    return this.http
      .patch<MachineProfile>(`${this.baseUrl}/machine-profiles/${id}`, data)
      .pipe(tap((profile) => this.upsertMachineProfile(profile)));
  }

  deleteMachineProfile(id: string): Observable<{ deleted: boolean }> {
    return this.http
      .delete<{ deleted: boolean }>(`${this.baseUrl}/machine-profiles/${id}`)
      .pipe(tap(() => this.removeMachineProfile(id)));
  }

  addFilamentPrice(
    data: Omit<FilamentPriceConfig, 'id'>,
  ): Observable<FilamentPriceConfig> {
    return this.http
      .post<FilamentPriceConfig>(`${this.baseUrl}/general/filament-prices`, data)
      .pipe(tap((entry) => this.upsertFilamentPrice(entry)));
  }

  updateFilamentPrice(
    id: string,
    data: Partial<Omit<FilamentPriceConfig, 'id'>>,
  ): Observable<FilamentPriceConfig> {
    return this.http
      .patch<FilamentPriceConfig>(
        `${this.baseUrl}/general/filament-prices/${id}`,
        data,
      )
      .pipe(tap((entry) => this.upsertFilamentPrice(entry)));
  }

  deleteFilamentPrice(id: string): Observable<{ deleted: boolean }> {
    return this.http
      .delete<{ deleted: boolean }>(
        `${this.baseUrl}/general/filament-prices/${id}`,
      )
      .pipe(tap(() => this.removeFilamentPrice(id)));
  }

  addResinPrice(
    data: Omit<ResinPriceConfig, 'id'>,
  ): Observable<ResinPriceConfig> {
    return this.http
      .post<ResinPriceConfig>(`${this.baseUrl}/general/resin-prices`, data)
      .pipe(tap((entry) => this.upsertResinPrice(entry)));
  }

  updateResinPrice(
    id: string,
    data: Partial<Omit<ResinPriceConfig, 'id'>>,
  ): Observable<ResinPriceConfig> {
    return this.http
      .patch<ResinPriceConfig>(`${this.baseUrl}/general/resin-prices/${id}`, data)
      .pipe(tap((entry) => this.upsertResinPrice(entry)));
  }

  deleteResinPrice(id: string): Observable<{ deleted: boolean }> {
    return this.http
      .delete<{ deleted: boolean }>(`${this.baseUrl}/general/resin-prices/${id}`)
      .pipe(tap(() => this.removeResinPrice(id)));
  }

  addColor(data: Omit<ColorConfig, 'id'>): Observable<ColorConfig> {
    return this.http
      .post<ColorConfig>(`${this.baseUrl}/general/colors`, data)
      .pipe(tap((entry) => this.upsertColor(entry)));
  }

  updateColor(
    id: string,
    data: Partial<Omit<ColorConfig, 'id'>>,
  ): Observable<ColorConfig> {
    return this.http
      .patch<ColorConfig>(`${this.baseUrl}/general/colors/${id}`, data)
      .pipe(tap((entry) => this.upsertColor(entry)));
  }

  deleteColor(id: string): Observable<{ deleted: boolean }> {
    return this.http
      .delete<{ deleted: boolean }>(`${this.baseUrl}/general/colors/${id}`)
      .pipe(tap(() => this.removeColor(id)));
  }

  addPowerConsumption(
    data: Omit<PowerConsumptionConfig, 'id'>,
  ): Observable<PowerConsumptionConfig> {
    return this.http
      .post<PowerConsumptionConfig>(
        `${this.baseUrl}/general/power-consumptions`,
        data,
      )
      .pipe(tap(() => this.settingsFacade.load(true)));
  }

  updatePowerConsumption(
    id: string,
    data: Partial<Omit<PowerConsumptionConfig, 'id'>>,
  ): Observable<PowerConsumptionConfig> {
    return this.http
      .patch<PowerConsumptionConfig>(
        `${this.baseUrl}/general/power-consumptions/${id}`,
        data,
      )
      .pipe(tap(() => this.settingsFacade.load(true)));
  }

  deletePowerConsumption(id: string): Observable<{ deleted: boolean }> {
    return this.http
      .delete<{ deleted: boolean }>(
        `${this.baseUrl}/general/power-consumptions/${id}`,
      )
      .pipe(tap(() => this.settingsFacade.load(true)));
  }

  addMachineCost(
    data: Omit<MachineCostConfig, 'id'>,
  ): Observable<MachineCostConfig> {
    return this.http
      .post<MachineCostConfig>(`${this.baseUrl}/general/machine-costs`, data)
      .pipe(tap(() => this.settingsFacade.load(true)));
  }

  updateMachineCost(
    id: string,
    data: Partial<Omit<MachineCostConfig, 'id'>>,
  ): Observable<MachineCostConfig> {
    return this.http
      .patch<MachineCostConfig>(
        `${this.baseUrl}/general/machine-costs/${id}`,
        data,
      )
      .pipe(tap(() => this.settingsFacade.load(true)));
  }

  deleteMachineCost(id: string): Observable<{ deleted: boolean }> {
    return this.http
      .delete<{ deleted: boolean }>(
        `${this.baseUrl}/general/machine-costs/${id}`,
      )
      .pipe(tap(() => this.settingsFacade.load(true)));
  }

  getSupplyDefaultPrice(data: {
    category: SupplyCategory;
    brand?: string;
    filamentType?: string;
    resinType?: string;
  }): Observable<{ unitPrice: number; unit: string; fromSettings: boolean } | null> {
    return this.http.post<{ unitPrice: number; unit: string; fromSettings: boolean } | null>(
      `${this.baseUrl}/supply-default-price`,
      data,
    );
  }

  resetDatabase(code: string): Observable<{ reset: true }> {
    return this.http.post<{ reset: true }>(`${this.baseUrl}/reset-database`, {
      code,
    });
  }

  private patchSettings(partial: Partial<GeneralSettings>): void {
    const current = this.settingsFacade.peekGeneralSettings();
    if (!current) {
      this.settingsFacade.load(true);
      return;
    }

    this.settingsFacade.setGeneral({
      ...current,
      ...partial,
    });
  }

  private upsertFilamentPrice(entry: FilamentPriceConfig): void {
    const current = this.settingsFacade.peekGeneralSettings();
    if (!current) {
      this.settingsFacade.load(true);
      return;
    }

    const exists = current.filamentPrices.some((price) => price.id === entry.id);
    this.settingsFacade.setGeneral({
      ...current,
      filamentPrices: exists
        ? current.filamentPrices.map((price) =>
            price.id === entry.id ? entry : price,
          )
        : [...current.filamentPrices, entry],
    });
  }

  private removeFilamentPrice(id: string): void {
    const current = this.settingsFacade.peekGeneralSettings();
    if (!current) {
      this.settingsFacade.load(true);
      return;
    }

    this.settingsFacade.setGeneral({
      ...current,
      filamentPrices: current.filamentPrices.filter((price) => price.id !== id),
    });
  }

  private upsertResinPrice(entry: ResinPriceConfig): void {
    const current = this.settingsFacade.peekGeneralSettings();
    if (!current) {
      this.settingsFacade.load(true);
      return;
    }

    const exists = current.resinPrices.some((price) => price.id === entry.id);
    this.settingsFacade.setGeneral({
      ...current,
      resinPrices: exists
        ? current.resinPrices.map((price) =>
            price.id === entry.id ? entry : price,
          )
        : [...current.resinPrices, entry],
    });
  }

  private removeResinPrice(id: string): void {
    const current = this.settingsFacade.peekGeneralSettings();
    if (!current) {
      this.settingsFacade.load(true);
      return;
    }

    this.settingsFacade.setGeneral({
      ...current,
      resinPrices: current.resinPrices.filter((price) => price.id !== id),
    });
  }

  private upsertColor(entry: ColorConfig): void {
    const current = this.settingsFacade.peekGeneralSettings();
    if (!current) {
      this.settingsFacade.load(true);
      return;
    }

    const colors = current.colors ?? [];
    const exists = colors.some((color) => color.id === entry.id);
    this.settingsFacade.setGeneral({
      ...current,
      colors: exists
        ? colors.map((color) => (color.id === entry.id ? entry : color))
        : [...colors, entry],
    });
  }

  private removeColor(id: string): void {
    const current = this.settingsFacade.peekGeneralSettings();
    if (!current) {
      this.settingsFacade.load(true);
      return;
    }

    this.settingsFacade.setGeneral({
      ...current,
      colors: (current.colors ?? []).filter((color) => color.id !== id),
    });
  }

  private upsertMachineProfile(profile: MachineProfile): void {
    const current = this.settingsFacade.peekGeneralSettings();
    if (!current) {
      this.settingsFacade.load(true);
      return;
    }

    const exists = current.machineProfiles.some((item) => item.id === profile.id);
    this.settingsFacade.setGeneral({
      ...current,
      machineProfiles: exists
        ? current.machineProfiles.map((item) =>
            item.id === profile.id ? profile : item,
          )
        : [...current.machineProfiles, profile],
    });
  }

  private removeMachineProfile(id: string): void {
    const current = this.settingsFacade.peekGeneralSettings();
    if (!current) {
      this.settingsFacade.load(true);
      return;
    }

    this.settingsFacade.setGeneral({
      ...current,
      machineProfiles: current.machineProfiles.filter(
        (profile) => profile.id !== id,
      ),
    });
  }
}

@Injectable({ providedIn: 'root' })
export class SuppliesService {
  private readonly baseUrl = `${environment.apiUrl}/supplies`;
  private readonly http = inject(HttpClient);
  private readonly suppliesFacade = inject(SuppliesFacade);

  getSupplies(
    category?: SupplyCategory,
    refresh = false,
  ): Observable<Supply[]> {
    return this.watchSupplies(category, refresh);
  }

  watchSupplies(
    category?: SupplyCategory,
    refresh = false,
  ): Observable<Supply[]> {
    this.suppliesFacade.load(refresh, category);
    return this.suppliesFacade.supplies(category);
  }

  refreshSupplies(category?: SupplyCategory): Observable<Supply[]> {
    return this.watchSupplies(category, true);
  }

  getLowStock(): Observable<Supply[]> {
    return this.http.get<Supply[]>(`${this.baseUrl}/low-stock`);
  }

  getDefaultPrice(data: {
    category: SupplyCategory;
    brand?: string;
    filamentType?: string;
    resinType?: string;
  }): Observable<{ unitPrice: number; unit: string; fromSettings: boolean } | null> {
    return this.http.post<{ unitPrice: number; unit: string; fromSettings: boolean } | null>(
      `${this.baseUrl}/default-price`,
      data,
    );
  }

  createSupply(data: Omit<Supply, 'id' | 'updatedAt'>): Observable<Supply> {
    return this.http.post<Supply>(this.baseUrl, data).pipe(
      tap((supply) => {
        this.suppliesFacade.upsertSupply(supply);
      }),
    );
  }

  updateSupply(
    id: string,
    data: Partial<Omit<Supply, 'id'>>,
  ): Observable<Supply> {
    return this.http.patch<Supply>(`${this.baseUrl}/${id}`, data).pipe(
      tap((supply) => {
        this.suppliesFacade.upsertSupply(supply);
      }),
    );
  }

  deleteSupply(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.baseUrl}/${id}`).pipe(
      tap(() => {
        this.suppliesFacade.removeSupply(id);
      }),
    );
  }
}
