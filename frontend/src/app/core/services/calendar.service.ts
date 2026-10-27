import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CalendarEntry,
  CalendarFeedItem,
  CreateCalendarEntryPayload,
  UpdateCalendarEntryPayload,
} from '../models';

@Injectable({ providedIn: 'root' })
export class CalendarService {
  private readonly baseUrl = `${environment.apiUrl}/calendar`;

  constructor(private readonly http: HttpClient) {}

  getFeed(from: string, to: string): Observable<CalendarFeedItem[]> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http.get<CalendarFeedItem[]>(this.baseUrl, { params });
  }

  getEntries(): Observable<CalendarEntry[]> {
    return this.http.get<CalendarEntry[]>(`${this.baseUrl}/entries`);
  }

  getEntry(id: string): Observable<CalendarEntry> {
    return this.http.get<CalendarEntry>(`${this.baseUrl}/entries/${id}`);
  }

  createEntry(data: CreateCalendarEntryPayload): Observable<CalendarEntry> {
    return this.http.post<CalendarEntry>(`${this.baseUrl}/entries`, data);
  }

  updateEntry(
    id: string,
    data: UpdateCalendarEntryPayload,
  ): Observable<CalendarEntry> {
    return this.http.patch<CalendarEntry>(`${this.baseUrl}/entries/${id}`, data);
  }

  completeEntry(id: string, completed: boolean): Observable<CalendarEntry> {
    return this.http.patch<CalendarEntry>(
      `${this.baseUrl}/entries/${id}/complete`,
      { completed },
    );
  }

  deleteEntry(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(
      `${this.baseUrl}/entries/${id}`,
    );
  }
}
