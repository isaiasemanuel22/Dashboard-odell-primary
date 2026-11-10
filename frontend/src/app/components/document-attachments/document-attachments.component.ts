import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { DbAttachmentUploadComponent } from '../dashboard-form/db-attachment-upload/db-attachment-upload.component';
import type { DbAttachmentUploadFn } from '../dashboard-form/db-attachment-upload/db-attachment-upload.types';
import { ProductAttachment } from '../../core/models';
import {
  AttachmentUploadFolder,
  MediaUploadService,
} from '../../core/services/media-upload.service';

/** Máximo de adjuntos por pedido o presupuesto (igual que el backend). */
export const MAX_DOCUMENT_ATTACHMENTS = 10;

/** Adjuntos de pedido/presupuesto: envuelve db-attachment-upload sin depender del form de producto. */
@Component({
  selector: 'app-document-attachments',
  standalone: true,
  imports: [FormsModule, DbAttachmentUploadComponent],
  template: `
    <db-attachment-upload
      label="Adjuntos"
      hint="Archivos o imágenes de referencia (hasta {{ max }})"
      addLabel="+ Agregar archivo"
      [maxFiles]="max"
      [uploadFn]="uploadFn"
      [previewBeforeUpload]="false"
      [disabled]="disabled"
      [ngModel]="attachments"
      (attachmentsChange)="attachmentsChange.emit($event)"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentAttachmentsComponent {
  private readonly mediaUpload = inject(MediaUploadService);

  @Input() attachments: ProductAttachment[] = [];
  @Input() folder: AttachmentUploadFolder = 'orders';
  @Input() max = MAX_DOCUMENT_ATTACHMENTS;
  @Input() disabled = false;
  @Output() attachmentsChange = new EventEmitter<ProductAttachment[]>();

  readonly uploadFn: DbAttachmentUploadFn = (file) =>
    firstValueFrom(this.mediaUpload.uploadDocumentAttachment(file, this.folder));
}
