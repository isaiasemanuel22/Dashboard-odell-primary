import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
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

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly baseUrl = `${environment.apiUrl}/settings`;

  constructor(private readonly http: HttpClient) {}

  getGeneralSettings(): Observable<GeneralSettings> {
    return this.http.get<GeneralSettings>(`${this.baseUrl}/general`);
  }

  updateGeneralSettings(
    data: Partial<GeneralSettings>,
  ): Observable<GeneralSettings> {
    return this.http.patch<GeneralSettings>(`${this.baseUrl}/general`, data);
  }

  addFilamentPrice(
    data: Omit<FilamentPriceConfig, 'id'>,
  ): Observable<FilamentPriceConfig> {
    return this.http.post<FilamentPriceConfig>(
      `${this.baseUrl}/general/filament-prices`,
      data,
    );
  }

  updateFilamentPrice(
    id: string,
    data: Partial<Omit<FilamentPriceConfig, 'id'>>,
  ): Observable<FilamentPriceConfig> {
    return this.http.patch<FilamentPriceConfig>(
      `${this.baseUrl}/general/filament-prices/${id}`,
      data,
    );
  }

  deleteFilamentPrice(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(
      `${this.baseUrl}/general/filament-prices/${id}`,
    );
  }

  addResinPrice(
    data: Omit<ResinPriceConfig, 'id'>,
  ): Observable<ResinPriceConfig> {
    return this.http.post<ResinPriceConfig>(
      `${this.baseUrl}/general/resin-prices`,
      data,
    );
  }

  updateResinPrice(
    id: string,
    data: Partial<Omit<ResinPriceConfig, 'id'>>,
  ): Observable<ResinPriceConfig> {
    return this.http.patch<ResinPriceConfig>(
      `${this.baseUrl}/general/resin-prices/${id}`,
      data,
    );
  }

  deleteResinPrice(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(
      `${this.baseUrl}/general/resin-prices/${id}`,
    );
  }

  addPowerConsumption(
    data: Omit<PowerConsumptionConfig, 'id'>,
  ): Observable<PowerConsumptionConfig> {
    return this.http.post<PowerConsumptionConfig>(
      `${this.baseUrl}/general/power-consumptions`,
      data,
    );
  }

  updatePowerConsumption(
    id: string,
    data: Partial<Omit<PowerConsumptionConfig, 'id'>>,
  ): Observable<PowerConsumptionConfig> {
    return this.http.patch<PowerConsumptionConfig>(
      `${this.baseUrl}/general/power-consumptions/${id}`,
      data,
    );
  }

  deletePowerConsumption(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(
      `${this.baseUrl}/general/power-consumptions/${id}`,
    );
  }

  addMachineCost(
    data: Omit<MachineCostConfig, 'id'>,
  ): Observable<MachineCostConfig> {
    return this.http.post<MachineCostConfig>(
      `${this.baseUrl}/general/machine-costs`,
      data,
    );
  }

  updateMachineCost(
    id: string,
    data: Partial<Omit<MachineCostConfig, 'id'>>,
  ): Observable<MachineCostConfig> {
    return this.http.patch<MachineCostConfig>(
      `${this.baseUrl}/general/machine-costs/${id}`,
      data,
    );
  }

  deleteMachineCost(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(
      `${this.baseUrl}/general/machine-costs/${id}`,
    );
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
}

@Injectable({ providedIn: 'root' })
export class SuppliesService {
  private readonly baseUrl = `${environment.apiUrl}/supplies`;

  constructor(private readonly http: HttpClient) {}

  getSupplies(type?: SupplyType, category?: SupplyCategory): Observable<Supply[]> {
    let params = new HttpParams();
    if (type) params = params.set('type', type);
    if (category) params = params.set('category', category);
    return this.http.get<Supply[]>(this.baseUrl, { params });
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
    return this.http.post<Supply>(this.baseUrl, data);
  }

  updateSupply(
    id: string,
    data: Partial<Omit<Supply, 'id'>>,
  ): Observable<Supply> {
    return this.http.patch<Supply>(`${this.baseUrl}/${id}`, data);
  }

  deleteSupply(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.baseUrl}/${id}`);
  }
}
