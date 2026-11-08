import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import {
  normalizePrintJob,
  normalizePrintJobs,
} from '../../shared/utils/task.helpers';
import { environment } from '../../../environments/environment';
import {
  DeliveryEstimate,
  PrintJob,
  PrinterCapacity,
  PrinterQueueResponse,
  PrintJobsBoard,
  PrintJobUpdateResult,
  ServiceType,
  SupplyShortageReport,
  UpdatePrintJobPayload,
} from '../models';

/** Evita 304/ETag o caché del navegador con datos viejos de la cola. */
const NO_CACHE_HEADERS = new HttpHeaders({
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
});

export interface CreateIndependentTaskPayload {
  productName: string;
  /** Vacío u omitido: la tarea queda sin área. */
  type?: ServiceType | '';
  dueDate?: string;
  responsibleUserId?: string;
  estimatedHours?: number;
}

@Injectable({ providedIn: 'root' })
export class PrintJobsService {
  private readonly baseUrl = `${environment.apiUrl}/print-jobs`;

  constructor(private readonly http: HttpClient) {}

  createIndependent(
    payload: CreateIndependentTaskPayload,
  ): Observable<PrintJob> {
    return this.http
      .post<PrintJob & { taskType?: string }>(this.baseUrl, payload)
      .pipe(map((job) => normalizePrintJob(job)));
  }

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

  getPrinterQueue(): Observable<PrinterQueueResponse> {
    return this.http
      .get<PrinterQueueResponse>(`${this.baseUrl}/printer-queue`, {
        headers: NO_CACHE_HEADERS,
      })
      .pipe(
        map((queue) => ({
          ...queue,
          printers: queue.printers.map((lane) => ({
            ...lane,
            jobs: lane.jobs.map((job) => ({
              ...normalizePrintJob(job),
              colors: job.colors ?? [],
              schedule: job.schedule ?? null,
            })),
          })),
          unassigned: queue.unassigned.map((job) => ({
            ...normalizePrintJob(job),
            colors: job.colors ?? [],
          })),
        })),
      );
  }

  getDeliveryEstimate(hours = 4): Observable<DeliveryEstimate> {
    return this.http.get<DeliveryEstimate>(`${this.baseUrl}/delivery-estimate`, {
      headers: NO_CACHE_HEADERS,
      params: { hours: String(hours) },
    });
  }

  getCapacity(weekOffset = 1): Observable<PrinterCapacity> {
    return this.http.get<PrinterCapacity>(`${this.baseUrl}/capacity`, {
      headers: NO_CACHE_HEADERS,
      params: { weekOffset: String(weekOffset) },
    });
  }

  assignPrinter(
    id: string,
    printerId: string | null | 'auto',
    position?: number,
  ): Observable<PrintJob> {
    return this.http
      .patch<PrintJob & { taskType?: string }>(`${this.baseUrl}/${id}/assignment`, {
        printerId,
        ...(position !== undefined ? { position } : {}),
      })
      .pipe(map((job) => normalizePrintJob(job)));
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
