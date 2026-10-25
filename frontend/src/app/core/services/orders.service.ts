import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { normalizePrintJobs } from '../../shared/utils/task.helpers';
import { environment } from '../../../environments/environment';
import {
  CreateOrderPayload,
  CreateOrderDeliveryPayload,
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
    return this.http.get<OrderOverview>(`${this.baseUrl}/orders/${id}/overview`).pipe(
      map((overview) => ({
        ...overview,
        tasks: normalizePrintJobs(overview.tasks),
      })),
    );
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

  decideOrderPrice(
    id: string,
    action: 'apply' | 'keep',
  ): Observable<Order> {
    return this.http.post<Order>(`${this.baseUrl}/orders/${id}/price-decision`, {
      action,
    });
  }

  addPayment(
    id: string,
    data: { amount: number; deposit?: boolean },
  ): Observable<Order> {
    return this.http.post<Order>(`${this.baseUrl}/orders/${id}/payments`, data);
  }

  createDelivery(
    id: string,
    data: CreateOrderDeliveryPayload,
  ): Observable<unknown> {
    return this.http.post(
      `${this.baseUrl}/orders/${id}/deliveries`,
      data,
    );
  }

  deleteOrder(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(
      `${this.baseUrl}/orders/${id}`,
    );
  }
}
