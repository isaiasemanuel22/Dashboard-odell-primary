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
import { DbFormErrorComponent } from '../db-form-error/db-form-error.component';
import { DbFormFieldComponent } from '../db-form-field/db-form-field.component';
import {
  DbAttachmentUploadFn,
  DbAttachmentUploadStagedItem,
} from './db-attachment-upload.types';

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
      this.uploadError = this.resolveUploadError(err);
    } finally {
      this.uploading = false;
    }
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const selected = input.files ? Array.from(input.files) : [];
    input.value = '';

    if (!selected.length) return;

    let filesToProcess = selected;
    if (this.maxFiles !== undefined) {
      const remaining = this.maxFiles - this.totalCount;
      if (remaining <= 0) return;
      if (filesToProcess.length > remaining) {
        filesToProcess = filesToProcess.slice(0, remaining);
      }
    }

    if (this.uploadFn && this.previewBeforeUpload) {
      this.stageFiles(filesToProcess);
    } else if (this.uploadFn) {
      void this.uploadFilesImmediately(filesToProcess);
    }

    this.onTouched();
  }

  formatFileSize(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex += 1;
    }
    const decimals = unitIndex === 0 ? 0 : 1;
    return `${value.toFixed(decimals)} ${units[unitIndex]}`;
  }

  private stageFiles(selected: File[]): void {
    const next = selected.map((file) => ({
      id: `staged-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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
      this.uploadError = this.resolveUploadError(err);
    } finally {
      this.uploading = false;
    }
  }

  private emitChange(): void {
    const next = [...this.attachments];
    this.onChange(next);
    this.attachmentsChange.emit(next);
  }

  private resolveUploadError(err: unknown): string {
    if (err && typeof err === 'object' && 'error' in err) {
      const body = (err as { error?: { message?: string } | string }).error;
      if (typeof body === 'string' && body.trim()) return body;
      if (body && typeof body === 'object' && 'message' in body) {
        const message = (body as { message?: string }).message;
        if (message?.trim()) return message;
      }
    }
    return 'Error al subir el archivo';
  }
}
