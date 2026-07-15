import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CreateImpresoPayload,
  ImpresoCostPreview,
  ImpresoWithCost,
  PaperType,
  UpdateImpresoPayload,
} from '../models';

@Injectable({ providedIn: 'root' })
export class ImpresosService {
  private readonly baseUrl = `${environment.apiUrl}/impresos`;

  constructor(private readonly http: HttpClient) {}

  getImpresos(paperType?: PaperType): Observable<ImpresoWithCost[]> {
    let params = new HttpParams();
    if (paperType) params = params.set('paperType', paperType);
    return this.http.get<ImpresoWithCost[]>(this.baseUrl, { params });
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
    return this.http.post<ImpresoWithCost>(this.baseUrl, data);
  }

  updateImpreso(
    id: string,
    data: UpdateImpresoPayload,
  ): Observable<ImpresoWithCost> {
    return this.http.patch<ImpresoWithCost>(`${this.baseUrl}/${id}`, data);
  }

  deleteImpreso(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.baseUrl}/${id}`);
  }
}
