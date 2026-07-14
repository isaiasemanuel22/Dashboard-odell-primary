import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CreateOrderPayload,
  Order,
  OrderOverview,
  OrderStatus,
  ServiceType,
  UpdateOrderPayload,
} from '../models';

export interface OrderListQuery {
  customerId?: string;
  status?: OrderStatus;
  openOnly?: boolean;
  service?: ServiceType;
  q?: string;
}

@Injectable({ providedIn: 'root' })
export class OrdersService {
  private readonly baseUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  getOrders(query: OrderListQuery = {}): Observable<Order[]> {
    let params = new HttpParams();
    if (query.customerId) params = params.set('customerId', query.customerId);
    if (query.status) params = params.set('status', query.status);
    if (query.openOnly) params = params.set('openOnly', 'true');
    if (query.service) params = params.set('service', query.service);
    if (query.q) params = params.set('q', query.q);
    return this.http.get<Order[]>(`${this.baseUrl}/orders`, { params });
  }

  getOrder(id: string): Observable<Order> {
    return this.http.get<Order>(`${this.baseUrl}/orders/${id}`);
  }

  getOrderOverview(id: string): Observable<OrderOverview> {
    return this.http.get<OrderOverview>(`${this.baseUrl}/orders/${id}/overview`);
  }

  createOrder(data: CreateOrderPayload): Observable<Order> {
    return this.http.post<Order>(`${this.baseUrl}/orders`, data);
  }

  updateOrder(id: string, data: UpdateOrderPayload): Observable<Order> {
    return this.http.patch<Order>(`${this.baseUrl}/orders/${id}`, data);
  }

  updateOrderStatus(id: string, status: OrderStatus): Observable<Order> {
    return this.http.patch<Order>(`${this.baseUrl}/orders/${id}/status`, {
      status,
    });
  }

  deleteOrder(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(
      `${this.baseUrl}/orders/${id}`,
    );
  }
}
