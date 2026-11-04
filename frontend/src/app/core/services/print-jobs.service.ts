import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { normalizePrintJob, normalizePrintJobs } from '../../shared/utils/task.helpers';
import { environment } from '../../../environments/environment';
import {
  PrintJob,
  PrintJobsBoard,
  PrintJobUpdateResult,
  SupplyShortageReport,
  UpdatePrintJobPayload,
} from '../models';

@Injectable({ providedIn: 'root' })
export class PrintJobsService {
  private readonly baseUrl = `${environment.apiUrl}/print-jobs`;

  constructor(private readonly http: HttpClient) {}

  blockTasksMissingSupplies(): Observable<{ blocked: boolean }> {
    return this.http.post<{ blocked: boolean }>(
      `${this.baseUrl}/reconcile-missing-supplies`,
      {},
    );
  }

  getBoard(): Observable<PrintJobsBoard> {
    return this.http.get<PrintJobsBoard>(`${this.baseUrl}/board`).pipe(
      map((board) => ({
        ...board,
        jobs: normalizePrintJobs(board.jobs),
      })),
    );
  }

  getPrintJobs(): Observable<PrintJob[]> {
    return this.http
      .get<Array<PrintJob & { taskType?: string }>>(this.baseUrl)
      .pipe(map((jobs) => normalizePrintJobs(jobs)));
  }

  getPrintJobsByOrder(orderId: string): Observable<PrintJob[]> {
    return this.http
      .get<Array<PrintJob & { taskType?: string }>>(this.baseUrl, {
        params: { orderId },
      })
      .pipe(map((jobs) => normalizePrintJobs(jobs)));
  }

  getSupplyShortages(id: string): Observable<SupplyShortageReport> {
    return this.http.get<SupplyShortageReport>(
      `${this.baseUrl}/${id}/supply-shortages`,
    );
  }

  getPrintJob(id: string): Observable<PrintJob> {
    return this.http
      .get<PrintJob & { taskType?: string }>(`${this.baseUrl}/${id}`)
      .pipe(map((job) => normalizePrintJob(job)));
  }

  updatePrintJob(
    id: string,
    payload: UpdatePrintJobPayload,
  ): Observable<PrintJobUpdateResult> {
    return this.http
      .patch<PrintJobUpdateResult & { taskType?: string }>(
        `${this.baseUrl}/${id}`,
        payload,
      )
      .pipe(
        map(
          (result): PrintJobUpdateResult => ({
            ...normalizePrintJob(result),
            orderStatus: result.orderStatus,
          }),
        ),
      );
  }
}
