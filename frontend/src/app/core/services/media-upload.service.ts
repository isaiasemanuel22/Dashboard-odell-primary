import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ProductsService } from './products.service';
import { UploadedAttachmentMeta } from '../../components/dashboard-form/db-attachment-upload/db-attachment-upload.types';

@Injectable({ providedIn: 'root' })
export class MediaUploadService {
  private readonly productsService = inject(ProductsService);

  /** Sube vía POST /api/upload; el backend guarda en Firebase Storage. */
  uploadProductImage(file: File): Observable<string> {
    return this.productsService
      .uploadImage(file)
      .pipe(map((result) => result.url));
  }

  uploadProductAttachment(file: File): Observable<UploadedAttachmentMeta> {
    return this.productsService.uploadAttachment(file);
  }
}
