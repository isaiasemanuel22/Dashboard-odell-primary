import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DashboardStats, DashboardStatsQuery } from '../models';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly baseUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  getStats(query: DashboardStatsQuery = {}): Observable<DashboardStats> {
    let params = new HttpParams();
    if (query.period) params = params.set('period', query.period);
    if (query.rankBy) params = params.set('rankBy', query.rankBy);
    return this.http.get<DashboardStats>(`${this.baseUrl}/dashboard/stats`, {
      params,
    });
  }
}
