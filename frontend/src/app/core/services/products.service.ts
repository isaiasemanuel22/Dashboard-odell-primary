import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Category,
  CreateProductPayload,
  Product,
  ProductPricingInput,
  ProductPricingResult,
  ProductOverview,
  ProductType,
  UpdateProductPayload,
} from '../models';

@Injectable({ providedIn: 'root' })
export class ProductsService {
  private readonly baseUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  getProducts(type?: ProductType, options?: { all?: boolean }): Observable<Product[]> {
    let params = new HttpParams();
    if (type) params = params.set('type', type);
    if (options?.all) params = params.set('all', 'true');
    return this.http.get<Product[]>(`${this.baseUrl}/products`, { params });
  }

  getProduct(id: string): Observable<Product> {
    return this.http.get<Product>(`${this.baseUrl}/products/${id}`);
  }

  getProductOverview(id: string): Observable<ProductOverview> {
    return this.http.get<ProductOverview>(
      `${this.baseUrl}/products/${id}/overview`,
    );
  }

  createProduct(data: CreateProductPayload): Observable<Product> {
    return this.http.post<Product>(`${this.baseUrl}/products`, data);
  }

  updateProduct(id: string, data: UpdateProductPayload): Observable<Product> {
    return this.http.patch<Product>(`${this.baseUrl}/products/${id}`, data);
  }

  previewPricing(data: ProductPricingInput): Observable<ProductPricingResult> {
    return this.http.post<ProductPricingResult>(
      `${this.baseUrl}/products/preview-pricing`,
      data,
    );
  }

  deleteProduct(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(
      `${this.baseUrl}/products/${id}`,
    );
  }

  getCategories(type?: ProductType): Observable<Category[]> {
    let params = new HttpParams();
    if (type) params = params.set('type', type);
    return this.http.get<Category[]>(`${this.baseUrl}/categories`, { params });
  }

  createCategory(data: {
    name: string;
    productTypes: ProductType[];
  }): Observable<Category> {
    return this.http.post<Category>(`${this.baseUrl}/categories`, data);
  }

  deleteCategory(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(
      `${this.baseUrl}/categories/${id}`,
    );
  }

  uploadImage(file: File): Observable<{ url: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ url: string }>(
      `${this.baseUrl}/upload`,
      formData,
    );
  }
}
