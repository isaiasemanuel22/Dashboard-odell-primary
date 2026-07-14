import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CreateCustomerPayload,
  Customer,
  UpdateCustomerPayload,
} from '../models';

@Injectable({ providedIn: 'root' })
export class CustomersService {
  private readonly baseUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  getCustomers(): Observable<Customer[]> {
    return this.http.get<Customer[]>(`${this.baseUrl}/customers`);
  }

  getCustomer(id: string): Observable<Customer> {
    return this.http.get<Customer>(`${this.baseUrl}/customers/${id}`);
  }

  createCustomer(data: CreateCustomerPayload): Observable<Customer> {
    return this.http.post<Customer>(`${this.baseUrl}/customers`, data);
  }

  updateCustomer(
    id: string,
    data: UpdateCustomerPayload,
  ): Observable<Customer> {
    return this.http.patch<Customer>(`${this.baseUrl}/customers/${id}`, data);
  }

  deleteCustomer(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(
      `${this.baseUrl}/customers/${id}`,
    );
  }
}
