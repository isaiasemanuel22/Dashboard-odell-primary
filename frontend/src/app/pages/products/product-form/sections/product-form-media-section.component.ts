import {
  ChangeDetectionStrategy,
  Component,
  Input,
  ViewChild,
} from '@angular/core';
import type {
  DbAttachmentUploadFn,
  DbFileUploadFn,
} from '@dashboard-form';
import { ProductFormFacade } from '../product-form.facade';
import { ProductFormAttachmentsUploadComponent } from './product-form-attachments-upload/product-form-attachments-upload.component';
import { ProductFormPhotosUploadComponent } from './product-form-photos-upload/product-form-photos-upload.component';

@Component({
  selector: 'app-product-form-media-section',
  standalone: true,
  imports: [
    ProductFormPhotosUploadComponent,
    ProductFormAttachmentsUploadComponent,
  ],
  templateUrl: './product-form-media-section.component.html',
  styleUrl: './product-form-media-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductFormMediaSectionComponent {
  @Input({ required: true }) facade!: ProductFormFacade;
  @Input({ required: true }) uploadProductImage!: DbFileUploadFn;
  @Input({ required: true }) uploadProductAttachment!: DbAttachmentUploadFn;

  @ViewChild(ProductFormPhotosUploadComponent)
  private photos?: ProductFormPhotosUploadComponent;

  @ViewChild(ProductFormAttachmentsUploadComponent)
  private attachments?: ProductFormAttachmentsUploadComponent;

  addAttachmentFiles(files: File[]): void {
    this.attachments?.addFiles(files);
  }

  async ensureUploads(): Promise<boolean> {
    if (!(await this.photos?.ensureUploaded())) return false;
    return (await this.attachments?.ensureUploaded()) ?? false;
  }
}
