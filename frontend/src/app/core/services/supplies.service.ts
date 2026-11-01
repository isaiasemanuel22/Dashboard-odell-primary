import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Supply, SupplyCategory, SupplyPriceChangeRow } from '../models';
import { SuppliesFacade } from '../../store/supplies/supplies.facade';

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

  /** Solo lectura; no pasa por el store NgRx de insumos. */
  getPriceChanges(days?: number): Observable<SupplyPriceChangeRow[]> {
    let params = new HttpParams();
    if (days !== undefined) {
      params = params.set('days', String(days));
    }
    return this.http.get<SupplyPriceChangeRow[]>(
      `${this.baseUrl}/price-changes`,
      { params },
    );
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
