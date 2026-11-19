import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AttendantStatus } from '../models';

@Injectable({ providedIn: 'root' })
export class AttendantService {
  private readonly baseUrl = `${environment.apiUrl}/attendant`;
  private readonly http = inject(HttpClient);

  status(): Observable<AttendantStatus> {
    return this.http.get<AttendantStatus>(`${this.baseUrl}/status`);
  }
}
