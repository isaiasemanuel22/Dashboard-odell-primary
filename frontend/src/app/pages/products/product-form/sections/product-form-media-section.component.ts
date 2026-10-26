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
  DbFileUploadComponent,
  DbFormErrorComponent,
} from '@dashboard-form';
import type {
  DbAttachmentUploadFn,
  DbFileUploadFn,
} from '@dashboard-form';
import { ProductFormFacade } from '../product-form.facade';

@Component({
  selector: 'app-product-form-media-section',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DbFileUploadComponent,
    DbAttachmentUploadComponent,
    DbFormErrorComponent,
  ],
  templateUrl: './product-form-media-section.component.html',
  styleUrl: '../product-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductFormMediaSectionComponent {
  @Input({ required: true }) facade!: ProductFormFacade;
  @Input({ required: true }) uploadProductImage!: DbFileUploadFn;
  @Input({ required: true }) uploadProductAttachment!: DbAttachmentUploadFn;

  @ViewChild(DbFileUploadComponent) private imageUpload?: DbFileUploadComponent;
  @ViewChild(DbAttachmentUploadComponent)
  private attachmentUpload?: DbAttachmentUploadComponent;

  private readonly cdr = inject(ChangeDetectorRef);

  async ensureUploads(): Promise<boolean> {
    this.facade.imageUploadError = '';
    this.facade.attachmentUploadError = '';

    if (this.imageUpload?.hasPendingUploads) {
      if (!(await this.uploadPendingImages())) return false;
    }

    if (this.attachmentUpload?.hasPendingUploads) {
      if (!(await this.uploadPendingAttachments())) return false;
    }

    return true;
  }

  private async uploadPendingImages(): Promise<boolean> {
    this.facade.savingImages = true;
    this.cdr.markForCheck();
    const uploaded = await this.imageUpload!.ensureUploaded();
    this.facade.savingImages = false;

    if (!uploaded) {
      this.facade.imageUploadError =
        this.imageUpload!.uploadError ||
        'No se pudieron subir las imágenes pendientes. Revisá la conexión e intentá de nuevo.';
      this.cdr.markForCheck();
      return false;
    }

    this.facade.form.patchValue({ images: [...this.imageUpload!.files] });
    return true;
  }

  private async uploadPendingAttachments(): Promise<boolean> {
    this.facade.savingAttachments = true;
    this.cdr.markForCheck();
    const uploaded = await this.attachmentUpload!.ensureUploaded();
    this.facade.savingAttachments = false;

    if (!uploaded) {
      this.facade.attachmentUploadError =
        this.attachmentUpload!.uploadError ||
        'No se pudieron subir los archivos pendientes. Revisá la conexión e intentá de nuevo.';
      this.cdr.markForCheck();
      return false;
    }

    this.facade.form.patchValue({
      attachments: [...this.attachmentUpload!.attachments],
    });
    return true;
  }
}
