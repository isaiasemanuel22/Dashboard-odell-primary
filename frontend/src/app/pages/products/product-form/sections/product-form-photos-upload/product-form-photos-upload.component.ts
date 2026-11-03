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
  DbFileUploadComponent,
  FileUploadSession,
} from '@dashboard-form';
import type { DbFileUploadFn } from '@dashboard-form';
import { ProductFormFacade } from '../../product-form.facade';

@Component({
  selector: 'app-product-form-photos-upload',
  standalone: true,
  imports: [ReactiveFormsModule, DbFileUploadComponent],
  templateUrl: './product-form-photos-upload.component.html',
  styleUrl: './product-form-photos-upload.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.is-drag]': 'session.dragOver',
    '(dragover)': 'onDragOver($event)',
    '(dragleave)': 'onDragLeave($event)',
    '(drop)': 'onDrop($event)',
  },
})
export class ProductFormPhotosUploadComponent {
  @Input({ required: true }) facade!: ProductFormFacade;
  @Input({ required: true }) uploadFn!: DbFileUploadFn;

  @ViewChild(DbFileUploadComponent) private upload?: DbFileUploadComponent;

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

  async ensureUploaded(): Promise<boolean> {
    this.facade.imageUploadError = '';
    if (!this.upload?.hasPendingUploads) return true;

    this.facade.savingImages = true;
    this.cdr.markForCheck();
    const uploaded = await this.upload.ensureUploaded();
    this.facade.savingImages = false;

    if (!uploaded) {
      this.facade.imageUploadError =
        this.upload.uploadError ||
        'No se pudieron subir las imágenes pendientes. Revisá la conexión e intentá de nuevo.';
      this.cdr.markForCheck();
      return false;
    }

    this.facade.form.patchValue({ images: [...this.upload.files] });
    return true;
  }
}
