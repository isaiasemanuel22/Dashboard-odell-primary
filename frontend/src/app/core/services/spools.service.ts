import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Spool, SpoolAlert, SpoolLocation } from '../models';

export type OpenSpoolPayload = {
  supplyId: string;
  grams?: number;
  location: SpoolLocation;
};

export type MoveSpoolPayload = {
  location: SpoolLocation;
};

export type AdjustSpoolPayload = {
  remainingGrams: number;
};

@Injectable({ providedIn: 'root' })
export class SpoolsService {
  private readonly baseUrl = `${environment.apiUrl}/spools`;
  private readonly http = inject(HttpClient);

  list(filters?: {
    open?: boolean;
    supplyId?: string;
    printerId?: string;
  }): Observable<Spool[]> {
    let params = new HttpParams();
    if (filters?.open !== undefined) {
      params = params.set('open', String(filters.open));
    }
    if (filters?.supplyId) {
      params = params.set('supplyId', filters.supplyId);
    }
    if (filters?.printerId) {
      params = params.set('printerId', filters.printerId);
    }
    return this.http.get<Spool[]>(this.baseUrl, { params });
  }

  get(id: string): Observable<Spool> {
    return this.http.get<Spool>(`${this.baseUrl}/${id}`);
  }

  alerts(): Observable<SpoolAlert[]> {
    return this.http.get<SpoolAlert[]>(`${this.baseUrl}/alerts`);
  }

  open(data: OpenSpoolPayload): Observable<Spool> {
    return this.http.post<Spool>(this.baseUrl, data);
  }

  move(id: string, data: MoveSpoolPayload): Observable<Spool> {
    return this.http.patch<Spool>(`${this.baseUrl}/${id}`, data);
  }

  adjust(id: string, data: AdjustSpoolPayload): Observable<Spool> {
    return this.http.patch<Spool>(`${this.baseUrl}/${id}/adjust`, data);
  }

  finish(id: string): Observable<Spool> {
    return this.http.post<Spool>(`${this.baseUrl}/${id}/finish`, {});
  }
}
