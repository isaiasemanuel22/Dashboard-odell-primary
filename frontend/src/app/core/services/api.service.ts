import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Customer,
  DashboardStats,
  Material,
  Order,
  PrintJob,
} from '../models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly baseUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  getDashboardStats(): Observable<DashboardStats | null> {
    return this.http
      .get<DashboardStats>(`${this.baseUrl}/dashboard/stats`)
      .pipe(catchError(() => of(null)));
  }

  getCustomers(): Observable<Customer[]> {
    return this.http
      .get<Customer[]>(`${this.baseUrl}/customers`)
      .pipe(catchError(() => of([])));
  }

  getOrders(): Observable<Order[]> {
    return this.http
      .get<Order[]>(`${this.baseUrl}/orders`)
      .pipe(catchError(() => of([])));
  }

  getPrintJobs(): Observable<PrintJob[]> {
    return this.http
      .get<PrintJob[]>(`${this.baseUrl}/print-jobs`)
      .pipe(catchError(() => of([])));
  }

  getMaterials(): Observable<Material[]> {
    return this.http
      .get<Material[]>(`${this.baseUrl}/materials`)
      .pipe(catchError(() => of([])));
  }
}
