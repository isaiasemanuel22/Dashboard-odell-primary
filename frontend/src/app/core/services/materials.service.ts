import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Material } from '../models';

@Injectable({ providedIn: 'root' })
export class MaterialsService {
  private readonly baseUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  getMaterials(): Observable<Material[]> {
    return this.http.get<Material[]>(`${this.baseUrl}/materials`);
  }
}
