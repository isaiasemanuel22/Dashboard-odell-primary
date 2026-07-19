import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CreateImpresoPayload,
  ImpresoCostPreview,
  ImpresoWithCost,
  PaperType,
  UpdateImpresoPayload,
} from '../models';
import { ImpresosFacade } from '../../store/impresos/impresos.facade';

@Injectable({ providedIn: 'root' })
export class ImpresosService {
  private readonly baseUrl = `${environment.apiUrl}/impresos`;
  private readonly http = inject(HttpClient);
  private readonly impresosFacade = inject(ImpresosFacade);

  getImpresos(paperType?: PaperType): Observable<ImpresoWithCost[]> {
    this.impresosFacade.load(false, paperType);
    return this.impresosFacade.impresos(paperType);
  }

  previewCost(data: {
    paperType: PaperType;
    widthCm: number;
    lengthCm?: number;
    heightCm: number;
  }): Observable<ImpresoCostPreview> {
    return this.http.post<ImpresoCostPreview>(
      `${this.baseUrl}/preview-cost`,
      data,
    );
  }

  createImpreso(data: CreateImpresoPayload): Observable<ImpresoWithCost> {
    return this.http.post<ImpresoWithCost>(this.baseUrl, data).pipe(
      tap((impreso) => this.impresosFacade.upsertImpreso(impreso)),
    );
  }

  updateImpreso(
    id: string,
    data: UpdateImpresoPayload,
  ): Observable<ImpresoWithCost> {
    return this.http.patch<ImpresoWithCost>(`${this.baseUrl}/${id}`, data).pipe(
      tap((impreso) => this.impresosFacade.upsertImpreso(impreso)),
    );
  }

  deleteImpreso(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.baseUrl}/${id}`).pipe(
      tap(() => this.impresosFacade.removeImpreso(id)),
    );
  }
}
