import {
  Component,
  EventEmitter,
  forwardRef,
  Input,
  Output,
} from '@angular/core';
import {
  ControlValueAccessor,
  FormsModule,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';
import { DbFormFieldComponent } from '../db-form-field/db-form-field.component';
import { DbFormErrorComponent } from '../db-form-error/db-form-error.component';
import { DbButtonComponent } from '../../db-button/db-button.component';
import { DbFileUploadFn } from './db-file-upload.types';

let dbFileUploadId = 0;

@Component({
  selector: 'db-file-upload',
  standalone: true,
  imports: [FormsModule, DbFormFieldComponent, DbFormErrorComponent, DbButtonComponent],
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
export class DbFileUploadComponent implements ControlValueAccessor {
  @Input() label = '';
  @Input() hint = '';
  @Input() error = '';
  @Input() accept = 'image/*';
  @Input() multiple = true;
  @Input() addLabel = '+ Agregar';
  @Input() uploadingLabel = 'Subiendo...';
  @Input() thumbAlt = '';
  @Input() disabled = false;
  @Input() maxFiles?: number;
  @Input() uploadFn?: DbFileUploadFn;

  @Output() filesSelected = new EventEmitter<File[]>();

  readonly inputId = `db-file-upload-${++dbFileUploadId}`;
  files: string[] = [];
  uploading = false;
  uploadError = '';

  private onChange: (value: string[]) => void = () => {};
  private onTouched: () => void = () => {};

  get canAddMore(): boolean {
    if (this.disabled || this.uploading) return false;
    if (this.maxFiles === undefined) return true;
    return this.files.length < this.maxFiles;
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

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const selected = input.files ? Array.from(input.files) : [];
    input.value = '';

    if (!selected.length) return;

    if (this.maxFiles !== undefined) {
      const remaining = this.maxFiles - this.files.length;
      if (remaining <= 0) return;
      if (selected.length > remaining) {
        selected.splice(remaining);
      }
    }

    if (this.uploadFn) {
      void this.uploadFiles(selected);
    } else {
      this.filesSelected.emit(selected);
    }

    this.onTouched();
  }

  private async uploadFiles(selected: File[]): Promise<void> {
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
