import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  ViewChild,
  inject,
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import {
  DbAttachmentUploadComponent,
  DbFormErrorComponent,
  FileUploadSession,
} from '@dashboard-form';
import type { DbAttachmentUploadFn } from '@dashboard-form';
import { ProductFormFacade } from '../../product-form.facade';

@Component({
  selector: 'app-product-form-attachments-upload',
  standalone: true,
  imports: [ReactiveFormsModule, DbAttachmentUploadComponent, DbFormErrorComponent],
  templateUrl: './product-form-attachments-upload.component.html',
  styleUrl: './product-form-attachments-upload.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.is-drag]': 'session.dragOver',
    '(dragover)': 'onDragOver($event)',
    '(dragleave)': 'onDragLeave($event)',
    '(drop)': 'onDrop($event)',
  },
})
export class ProductFormAttachmentsUploadComponent {
  @Input({ required: true }) facade!: ProductFormFacade;
  @Input({ required: true }) uploadFn!: DbAttachmentUploadFn;

  @ViewChild(DbAttachmentUploadComponent)
  private upload?: DbAttachmentUploadComponent;

  readonly session = new FileUploadSession();
  private readonly cdr = inject(ChangeDetectorRef);

  onDragOver(event: DragEvent): void {
    this.session.onDragOver(event);
    this.cdr.markForCheck();
  }

  onDragLeave(event: DragEvent): void {
    this.session.onDragLeave(event);
    this.cdr.markForCheck();
  }

  onDrop(event: DragEvent): void {
    const files = this.session.onDrop(event);
    if (files.length) this.upload?.addFiles(files);
    this.cdr.markForCheck();
  }

  addFiles(files: File[]): void {
    if (!files.length) return;
    this.upload?.addFiles(files);
    this.cdr.markForCheck();
  }

  /**
   * Intenta subir pendientes. Si falla, deja aviso y descarta el staged
   * para que el producto se pueda guardar igual sin el adjunto.
   */
  async ensureUploaded(): Promise<boolean> {
    this.facade.attachmentUploadError = '';
    if (!this.upload?.hasPendingUploads) return true;

    this.facade.savingAttachments = true;
    this.cdr.markForCheck();
    const uploaded = await this.upload.ensureUploaded();
    this.facade.savingAttachments = false;

    if (!uploaded) {
      this.facade.attachmentUploadError =
        this.upload.uploadError ||
        'No se pudo subir el adjunto; el producto se guarda igual sin ese archivo.';
      this.upload.clearStaged();
      this.cdr.markForCheck();
      // Soft-fail: no bloquear el alta/edición del producto.
      return true;
    }

    this.facade.form.patchValue({
      attachments: [...this.upload.attachments],
    });
    return true;
  }
}
