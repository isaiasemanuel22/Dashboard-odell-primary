import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ChatDetail,
  ChatList,
  ChatListQuery,
  ChatMessage,
  ChatSummary,
  SendChatMessagePayload,
} from '../models';

@Injectable({ providedIn: 'root' })
export class ChatsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/chats`;

  list(query: ChatListQuery = {}): Observable<ChatList> {
    let params = new HttpParams();
    if (query.channel) params = params.set('channel', query.channel);
    if (query.filter) params = params.set('filter', query.filter);
    const search = query.search?.trim();
    if (search) params = params.set('search', search);
    return this.http.get<ChatList>(this.baseUrl, { params });
  }

  unreadCount(): Observable<{ unreadConversations: number }> {
    return this.http.get<{ unreadConversations: number }>(
      `${this.baseUrl}/unread-count`,
    );
  }

  get(id: string): Observable<ChatDetail> {
    return this.http.get<ChatDetail>(`${this.baseUrl}/${id}`);
  }

  send(id: string, payload: SendChatMessagePayload): Observable<ChatMessage> {
    return this.http.post<ChatMessage>(`${this.baseUrl}/${id}/messages`, payload);
  }

  markRead(id: string): Observable<ChatSummary> {
    return this.http.post<ChatSummary>(`${this.baseUrl}/${id}/read`, {});
  }

  linkCustomer(id: string, customerId: string): Observable<ChatSummary> {
    return this.http.put<ChatSummary>(`${this.baseUrl}/${id}/customer`, {
      customerId,
    });
  }

  setAgentPaused(id: string, paused: boolean): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${id}/agent-paused`, { paused });
  }

  unlinkCustomer(id: string): Observable<ChatSummary> {
    return this.http.delete<ChatSummary>(`${this.baseUrl}/${id}/customer`);
  }

  editSuggestion(id: string, messageId: string, text: string): Observable<ChatMessage> {
    return this.http.patch<ChatMessage>(
      `${this.baseUrl}/${id}/suggestions/${messageId}`,
      { text },
    );
  }

  /** Con `text`, se envía el texto editado en lugar del sugerido. */
  approveSuggestion(id: string, messageId: string, text?: string): Observable<ChatMessage> {
    return this.http.post<ChatMessage>(
      `${this.baseUrl}/${id}/suggestions/${messageId}/approve`,
      text === undefined ? {} : { text },
    );
  }

  discardSuggestion(id: string, messageId: string): Observable<ChatMessage> {
    return this.http.post<ChatMessage>(
      `${this.baseUrl}/${id}/suggestions/${messageId}/discard`,
      {},
    );
  }
}
