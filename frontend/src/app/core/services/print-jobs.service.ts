import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  PrintJob,
  PrintJobsBoard,
  PrintJobUpdateResult,
  UpdatePrintJobPayload,
} from '../models';

@Injectable({ providedIn: 'root' })
export class PrintJobsService {
  private readonly baseUrl = `${environment.apiUrl}/print-jobs`;

  constructor(private readonly http: HttpClient) {}

  getBoard(): Observable<PrintJobsBoard> {
    return this.http.get<PrintJobsBoard>(`${this.baseUrl}/board`);
  }

  getPrintJobs(): Observable<PrintJob[]> {
    return this.http.get<PrintJob[]>(this.baseUrl);
  }

  getPrintJobsByOrder(orderId: string): Observable<PrintJob[]> {
    return this.http.get<PrintJob[]>(this.baseUrl, {
      params: { orderId },
    });
  }

  getPrintJob(id: string): Observable<PrintJob> {
    return this.http.get<PrintJob>(`${this.baseUrl}/${id}`);
  }

  updatePrintJob(
    id: string,
    payload: UpdatePrintJobPayload,
  ): Observable<PrintJobUpdateResult> {
    return this.http.patch<PrintJobUpdateResult>(`${this.baseUrl}/${id}`, payload);
  }
}
