import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Supplier, SupplierOrderDraft } from '../models';

export type CreateSupplierPayload = {
  name: string;
  leadTimeBusinessDays?: number;
  contact?: string;
  notes?: string;
};

export type UpdateSupplierPayload = Partial<CreateSupplierPayload>;

@Injectable({ providedIn: 'root' })
export class SuppliersService {
  private readonly baseUrl = `${environment.apiUrl}/suppliers`;
  private readonly http = inject(HttpClient);

  list(): Observable<Supplier[]> {
    return this.http.get<Supplier[]>(this.baseUrl);
  }

  get(id: string): Observable<Supplier> {
    return this.http.get<Supplier>(`${this.baseUrl}/${id}`);
  }

  create(data: CreateSupplierPayload): Observable<Supplier> {
    return this.http.post<Supplier>(this.baseUrl, data);
  }

  update(id: string, data: UpdateSupplierPayload): Observable<Supplier> {
    return this.http.patch<Supplier>(`${this.baseUrl}/${id}`, data);
  }

  delete(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.baseUrl}/${id}`);
  }

  orderDraft(id: string): Observable<SupplierOrderDraft> {
    return this.http.get<SupplierOrderDraft>(
      `${this.baseUrl}/${id}/order-draft`,
    );
  }
}
