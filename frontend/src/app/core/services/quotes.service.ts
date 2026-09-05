import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CreateQuotePayload,
  Order,
  Quote,
  QuoteStatus,
  UpdateQuotePayload,
} from '../models';

@Injectable({ providedIn: 'root' })
export class QuotesService {
  private readonly baseUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  getQuotes(): Observable<Quote[]> {
    return this.http.get<Quote[]>(`${this.baseUrl}/quotes`);
  }

  getQuote(id: string): Observable<Quote> {
    return this.http.get<Quote>(`${this.baseUrl}/quotes/${id}`);
  }

  createQuote(data: CreateQuotePayload): Observable<Quote> {
    return this.http.post<Quote>(`${this.baseUrl}/quotes`, data);
  }

  updateQuote(id: string, data: UpdateQuotePayload): Observable<Quote> {
    return this.http.patch<Quote>(`${this.baseUrl}/quotes/${id}`, data);
  }

  updateQuoteStatus(id: string, status: QuoteStatus): Observable<Quote> {
    return this.http.patch<Quote>(`${this.baseUrl}/quotes/${id}/status`, {
      status,
    });
  }

  deleteQuote(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(
      `${this.baseUrl}/quotes/${id}`,
    );
  }

  createOrderFromQuote(id: string): Observable<Order> {
    return this.http.post<Order>(`${this.baseUrl}/quotes/${id}/order`, {});
  }
}
