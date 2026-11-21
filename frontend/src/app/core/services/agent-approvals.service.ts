import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AgentApproval } from '../models';

@Injectable({ providedIn: 'root' })
export class AgentApprovalsService {
  private readonly baseUrl = `${environment.apiUrl}/agent-approvals`;
  private readonly http = inject(HttpClient);

  listPending(): Observable<AgentApproval[]> {
    return this.http.get<AgentApproval[]>(this.baseUrl, {
      params: { status: 'pending' },
    });
  }

  approve(id: string): Observable<AgentApproval> {
    return this.http.post<AgentApproval>(`${this.baseUrl}/${id}/approve`, {});
  }

  reject(id: string): Observable<AgentApproval> {
    return this.http.post<AgentApproval>(`${this.baseUrl}/${id}/reject`, {});
  }
}
