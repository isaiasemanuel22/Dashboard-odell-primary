import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CreateTreasuryExpensePayload,
  TreasuryExpense,
  TreasuryOverview,
} from '../models';

@Injectable({ providedIn: 'root' })
export class TreasuryService {
  private readonly baseUrl = `${environment.apiUrl}/treasury`;

  constructor(private readonly http: HttpClient) {}

  getOverview(): Observable<TreasuryOverview> {
    return this.http.get<TreasuryOverview>(this.baseUrl);
  }

  createExpense(
    data: CreateTreasuryExpensePayload,
  ): Observable<TreasuryExpense[]> {
    return this.http.post<TreasuryExpense[]>(`${this.baseUrl}/expenses`, data);
  }
}
