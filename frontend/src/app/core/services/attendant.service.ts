import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AgentRun, AttendantStatus } from '../models';

@Injectable({ providedIn: 'root' })
export class AttendantService {
  private readonly baseUrl = `${environment.apiUrl}/attendant`;
  private readonly http = inject(HttpClient);

  status(): Observable<AttendantStatus> {
    return this.http.get<AttendantStatus>(`${this.baseUrl}/status`);
  }

  /** Últimas corridas del agente en un chat, la más nueva primero. */
  runs(conversationId: string, limit = 5): Observable<AgentRun[]> {
    return this.http.get<AgentRun[]>(
      `${this.baseUrl}/conversations/${conversationId}/runs`,
      { params: { limit } },
    );
  }
}
