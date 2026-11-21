import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiKey, ApiKeyScopeOption, CreatedApiKey } from '../models';

@Injectable({ providedIn: 'root' })
export class ApiKeysService {
  private readonly baseUrl = `${environment.apiUrl}/api-keys`;
  private readonly http = inject(HttpClient);

  list(): Observable<ApiKey[]> {
    return this.http.get<ApiKey[]>(this.baseUrl);
  }

  scopes(): Observable<ApiKeyScopeOption[]> {
    return this.http.get<ApiKeyScopeOption[]>(`${this.baseUrl}/scopes`);
  }

  create(data: { name: string; scopes: string[] }): Observable<CreatedApiKey> {
    return this.http.post<CreatedApiKey>(this.baseUrl, data);
  }

  revoke(id: string): Observable<ApiKey> {
    return this.http.post<ApiKey>(`${this.baseUrl}/${id}/revoke`, {});
  }
}
