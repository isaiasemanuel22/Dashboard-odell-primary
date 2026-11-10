import {
  Component,
  EventEmitter,
  forwardRef,
  Input,
  OnDestroy,
  Output,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import {
  ControlValueAccessor,
  FormsModule,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';
import { ProductAttachment } from '../../../core/models';
import { createProductAttachmentId } from '../../../shared/utils/product-attachment.helpers';
import { DbButtonComponent } from '../../db-button/db-button.component';
import { DbIconTrashComponent } from '../../db-icon-trash/db-icon-trash.component';
import { DbFormErrorComponent } from '../db-form-error/db-form-error.component';
import { DbFormFieldComponent } from '../db-form-field/db-form-field.component';
import { FileUploadSession } from '../file-upload/file-upload.session';
import {
  DbAttachmentUploadFn,
  DbAttachmentUploadStagedItem,
} from './db-attachment-upload.types';
import { formatFileSizeEsAr } from '../../../shared/utils/file-size.util';

let dbAttachmentUploadId = 0;

@Component({
  selector: 'db-attachment-upload',
  standalone: true,
  imports: [
    FormsModule,
    NgTemplateOutlet,
    DbFormFieldComponent,
    DbFormErrorComponent,
    DbButtonComponent,
    DbIconTrashComponent,
  ],
  templateUrl: './db-attachment-upload.component.html',
  styleUrl: './db-attachment-upload.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DbAttachmentUploadComponent),
      multi: true,
    },
  ],
})
export class DbAttachmentUploadComponent
  implements ControlValueAccessor, OnDestroy
{
  @Input() label = '';
  @Input() hint = '';
  @Input() error = '';
  @Input() multiple = true;
  @Input() addLabel = '+ Agregar archivo';
  @Input() uploadLabel = 'Subir archivos';
  @Input() uploadingLabel = 'Subiendo...';
  @Input() disabled = false;
  @Input() maxFiles?: number;
  @Input() uploadFn?: DbAttachmentUploadFn;
  @Input() previewBeforeUpload = true;

  @Output() attachmentsChange = new EventEmitter<ProductAttachment[]>();

  readonly inputId = `db-attachment-upload-${++dbAttachmentUploadId}`;
  attachments: ProductAttachment[] = [];
  staged: DbAttachmentUploadStagedItem[] = [];
  uploading = false;
  uploadError = '';

  private onChange: (value: ProductAttachment[]) => void = () => {};
  private onTouched: () => void = () => {};

  ngOnDestroy(): void {
    this.clearStaged(false);
  }

  get totalCount(): number {
    return this.attachments.length + this.staged.length;
  }

  get canAddMore(): boolean {
    if (this.disabled || this.uploading) return false;
    if (this.maxFiles === undefined) return true;
    return this.totalCount < this.maxFiles;
  }

  get hasStaged(): boolean {
    return this.staged.length > 0;
  }

  get hasPendingUploads(): boolean {
    return this.hasStaged;
  }

  writeValue(value: ProductAttachment[] | null): void {
    this.attachments = value ? [...value] : [];
  }

  registerOnChange(fn: (value: ProductAttachment[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  removeAttachment(index: number): void {
    if (this.disabled || this.uploading) return;
    this.attachments = this.attachments.filter((_, i) => i !== index);
    this.emitChange();
  }

  removeStaged(id: string): void {
    if (this.disabled || this.uploading) return;
    this.staged = this.staged.filter((entry) => entry.id !== id);
  }

  clearStaged(emitTouch = true): void {
    this.staged = [];
    if (emitTouch) {
      this.onTouched();
    }
  }

  async ensureUploaded(): Promise<boolean> {
    if (!this.staged.length) return true;
    if (!this.uploadFn) {
      this.uploadError = 'No hay servicio de subida configurado';
      return false;
    }
    await this.uploadStaged();
    return this.staged.length === 0 && !this.uploadError;
  }

  async uploadStaged(): Promise<void> {
    if (!this.uploadFn || !this.staged.length || this.uploading) return;

    this.uploadError = '';
    this.uploading = true;
    const batch = [...this.staged];

    try {
      const uploaded = await Promise.all(
        batch.map((item) => this.uploadFn!(item.file)),
      );
      this.staged = this.staged.filter((item) => !batch.includes(item));
      this.attachments = [
        ...this.attachments,
        ...uploaded.map((meta) => ({
          id: createProductAttachmentId(),
          ...meta,
        })),
      ];
      this.emitChange();
    } catch (err: unknown) {
      this.uploadError = FileUploadSession.uploadError(err);
    } finally {
      this.uploading = false;
    }
  }

  onFileInputChange(event: Event): void {
    this.addFiles(FileUploadSession.fromInput(event));
  }

  addFiles(selected: File[]): void {
    if (!selected.length || !this.canAddMore) return;

    const filesToProcess = FileUploadSession.withinLimit(
      selected,
      this.totalCount,
      this.maxFiles,
    );
    if (!filesToProcess.length) return;

    if (this.uploadFn && this.previewBeforeUpload) {
      this.stageFiles(filesToProcess);
    } else if (this.uploadFn) {
      void this.uploadFilesImmediately(filesToProcess);
    }

    this.onTouched();
  }

  formatFileSize(bytes: number): string {
    return formatFileSizeEsAr(bytes);
  }

  private stageFiles(selected: File[]): void {
    const next = selected.map((file) => ({
      id: FileUploadSession.stagedId(),
      file,
    }));
    this.staged = [...this.staged, ...next];
  }

  private async uploadFilesImmediately(selected: File[]): Promise<void> {
    if (!this.uploadFn) return;

    this.uploadError = '';
    this.uploading = true;

    try {
      const uploaded = await Promise.all(
        selected.map((file) => this.uploadFn!(file)),
      );
      this.attachments = [
        ...this.attachments,
        ...uploaded.map((meta) => ({
          id: createProductAttachmentId(),
          ...meta,
        })),
      ];
      this.emitChange();
    } catch (err: unknown) {
      this.uploadError = FileUploadSession.uploadError(err);
    } finally {
      this.uploading = false;
    }
  }

  private emitChange(): void {
    const next = [...this.attachments];
    this.onChange(next);
    this.attachmentsChange.emit(next);
  }
}
