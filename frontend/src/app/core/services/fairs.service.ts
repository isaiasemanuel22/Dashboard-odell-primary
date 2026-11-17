import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CloseFairPayload,
  CreateFairExpensePayload,
  CreateFairPayload,
  Fair,
  FairDetail,
  FairPlan,
  FairsOverview,
  UpdateFairPayload,
} from '../models';

@Injectable({ providedIn: 'root' })
export class FairsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/fairs`;

  /** `month` = YYYY-MM. */
  list(month?: string): Observable<FairsOverview> {
    const params = month ? new HttpParams().set('month', month) : undefined;
    return this.http.get<FairsOverview>(this.baseUrl, { params });
  }

  get(id: string): Observable<FairDetail> {
    return this.http.get<FairDetail>(`${this.baseUrl}/${id}`);
  }

  create(payload: CreateFairPayload): Observable<Fair> {
    return this.http.post<Fair>(this.baseUrl, payload);
  }

  update(id: string, payload: UpdateFairPayload): Observable<Fair> {
    return this.http.patch<Fair>(`${this.baseUrl}/${id}`, payload);
  }

  remove(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.baseUrl}/${id}`);
  }

  open(id: string, openingFloat: number): Observable<Fair> {
    return this.http.post<Fair>(`${this.baseUrl}/${id}/open`, { openingFloat });
  }

  addExpense(id: string, payload: CreateFairExpensePayload): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/${id}/expenses`, payload);
  }

  close(id: string, payload: CloseFairPayload): Observable<Fair> {
    return this.http.post<Fair>(`${this.baseUrl}/${id}/close`, payload);
  }

  plan(name: string): Observable<FairPlan> {
    const params = new HttpParams().set('name', name);
    return this.http.get<FairPlan>(`${this.baseUrl}/plan`, { params });
  }
}
