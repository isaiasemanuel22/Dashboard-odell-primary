import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ProductsService } from './products.service';
import { UploadedAttachmentMeta } from '../../components/dashboard-form/db-attachment-upload/db-attachment-upload.types';

export type AttachmentUploadFolder = 'orders' | 'quotes';

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

  /** Adjuntos de pedidos y presupuestos (carpeta propia en el storage). */
  uploadDocumentAttachment(
    file: File,
    folder: AttachmentUploadFolder,
  ): Observable<UploadedAttachmentMeta> {
    return this.productsService.uploadAttachment(file, folder);
  }
}
