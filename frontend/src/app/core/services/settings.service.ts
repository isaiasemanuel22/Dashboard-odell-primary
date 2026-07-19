import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CalculateCostPayload,
  CostBreakdown,
  FilamentPriceConfig,
  GeneralSettings,
  MachineCostConfig,
  PowerConsumptionConfig,
  ResinPriceConfig,
  Supply,
  SupplyCategory,
  SupplyType,
} from '../models';
import { SettingsFacade } from '../../store/settings/settings.facade';
import { SuppliesFacade } from '../../store/supplies/supplies.facade';

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

  updateGeneralSettings(
    data: Partial<GeneralSettings>,
  ): Observable<GeneralSettings> {
    return this.http
      .patch<GeneralSettings>(`${this.baseUrl}/general`, data)
      .pipe(tap((settings) => this.settingsFacade.setGeneral(settings)));
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
      .pipe(tap(() => this.settingsFacade.load(true)));
  }

  updateResinPrice(
    id: string,
    data: Partial<Omit<ResinPriceConfig, 'id'>>,
  ): Observable<ResinPriceConfig> {
    return this.http
      .patch<ResinPriceConfig>(`${this.baseUrl}/general/resin-prices/${id}`, data)
      .pipe(tap(() => this.settingsFacade.load(true)));
  }

  deleteResinPrice(id: string): Observable<{ deleted: boolean }> {
    return this.http
      .delete<{ deleted: boolean }>(`${this.baseUrl}/general/resin-prices/${id}`)
      .pipe(tap(() => this.settingsFacade.load(true)));
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

  calculateCost(data: CalculateCostPayload): Observable<CostBreakdown> {
    return this.http.post<CostBreakdown>(`${this.baseUrl}/calculate-cost`, data);
  }

  getSupplyDefaultPrice(data: {
    type: SupplyType;
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
}

@Injectable({ providedIn: 'root' })
export class SuppliesService {
  private readonly baseUrl = `${environment.apiUrl}/supplies`;
  private readonly http = inject(HttpClient);
  private readonly suppliesFacade = inject(SuppliesFacade);

  getSupplies(type?: SupplyType, category?: SupplyCategory): Observable<Supply[]> {
    this.suppliesFacade.load(false, type, category);
    return this.suppliesFacade.supplies(type, category);
  }

  getLowStock(): Observable<Supply[]> {
    return this.http.get<Supply[]>(`${this.baseUrl}/low-stock`);
  }

  getDefaultPrice(data: {
    type: SupplyType;
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
