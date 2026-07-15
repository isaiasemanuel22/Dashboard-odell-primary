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
import { DbFormFieldComponent } from '../db-form-field/db-form-field.component';
import { DbFormErrorComponent } from '../db-form-error/db-form-error.component';
import { DbButtonComponent } from '../../db-button/db-button.component';
import {
  DbFileUploadFn,
  DbFileUploadStagedItem,
} from './db-file-upload.types';

let dbFileUploadId = 0;

@Component({
  selector: 'db-file-upload',
  standalone: true,
  imports: [FormsModule, NgTemplateOutlet, DbFormFieldComponent, DbFormErrorComponent, DbButtonComponent],
  templateUrl: './db-file-upload.component.html',
  styleUrl: './db-file-upload.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DbFileUploadComponent),
      multi: true,
    },
  ],
})
export class DbFileUploadComponent implements ControlValueAccessor, OnDestroy {
  @Input() label = '';
  @Input() hint = '';
  @Input() error = '';
  @Input() accept = 'image/*';
  @Input() multiple = true;
  @Input() addLabel = '+ Agregar';
  @Input() uploadLabel = 'Subir imágenes';
  @Input() uploadingLabel = 'Subiendo...';
  @Input() thumbAlt = '';
  @Input() disabled = false;
  @Input() maxFiles?: number;
  @Input() uploadFn?: DbFileUploadFn;
  /** Si hay uploadFn, muestra preview local y espera confirmación antes de subir. */
  @Input() previewBeforeUpload = true;

  @Output() filesSelected = new EventEmitter<File[]>();

  readonly inputId = `db-file-upload-${++dbFileUploadId}`;
  files: string[] = [];
  staged: DbFileUploadStagedItem[] = [];
  uploading = false;
  uploadError = '';

  private onChange: (value: string[]) => void = () => {};
  private onTouched: () => void = () => {};

  ngOnDestroy(): void {
    this.clearStaged(false);
  }

  get totalCount(): number {
    return this.files.length + this.staged.length;
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

  writeValue(value: string[] | null): void {
    this.files = value ? [...value] : [];
  }

  registerOnChange(fn: (value: string[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  removeFile(index: number): void {
    if (this.disabled || this.uploading) return;
    this.files = this.files.filter((_, i) => i !== index);
    this.emitChange();
  }

  removeStaged(id: string): void {
    if (this.disabled || this.uploading) return;
    const item = this.staged.find((entry) => entry.id === id);
    if (item) {
      URL.revokeObjectURL(item.previewUrl);
    }
    this.staged = this.staged.filter((entry) => entry.id !== id);
  }

  clearStaged(emitTouch = true): void {
    for (const item of this.staged) {
      URL.revokeObjectURL(item.previewUrl);
    }
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
      const urls = await Promise.all(
        batch.map((item) => this.uploadFn!(item.file)),
      );
      for (const item of batch) {
        URL.revokeObjectURL(item.previewUrl);
      }
      this.staged = this.staged.filter((item) => !batch.includes(item));
      this.files = [...this.files, ...urls];
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
    } else {
      this.filesSelected.emit(filesToProcess);
    }

    this.onTouched();
  }

  private stageFiles(selected: File[]): void {
    const next = selected.map((file) => ({
      id: `staged-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    this.staged = [...this.staged, ...next];
  }

  private async uploadFilesImmediately(selected: File[]): Promise<void> {
    if (!this.uploadFn) return;

    this.uploadError = '';
    this.uploading = true;

    try {
      const urls = await Promise.all(selected.map((file) => this.uploadFn!(file)));
      this.files = [...this.files, ...urls];
      this.emitChange();
    } catch (err: unknown) {
      this.uploadError = this.resolveUploadError(err);
    } finally {
      this.uploading = false;
    }
  }

  private emitChange(): void {
    this.onChange([...this.files]);
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
