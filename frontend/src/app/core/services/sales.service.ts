import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CreateRetailSalePayload,
  RetailSale,
  SalesOverview,
  UpdateRetailSalePayload,
} from '../models';

@Injectable({ providedIn: 'root' })
export class SalesService {
  private readonly baseUrl = `${environment.apiUrl}/sales`;

  constructor(private readonly http: HttpClient) {}

  getOverview(): Observable<SalesOverview> {
    return this.http.get<SalesOverview>(this.baseUrl);
  }

  getRetailSale(id: string): Observable<RetailSale> {
    return this.http.get<RetailSale>(`${this.baseUrl}/retail/${id}`);
  }

  createRetailSale(data: CreateRetailSalePayload): Observable<RetailSale> {
    return this.http.post<RetailSale>(`${this.baseUrl}/retail`, data);
  }

  updateRetailSale(
    id: string,
    data: UpdateRetailSalePayload,
  ): Observable<RetailSale> {
    return this.http.patch<RetailSale>(`${this.baseUrl}/retail/${id}`, data);
  }

  deleteRetailSale(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(
      `${this.baseUrl}/retail/${id}`,
    );
  }
}
