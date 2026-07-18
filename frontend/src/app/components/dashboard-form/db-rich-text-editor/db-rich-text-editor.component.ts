import {
  Component,
  forwardRef,
  Input,
  OnInit,
  ViewChild,
} from '@angular/core';
import {
  ControlValueAccessor,
  FormsModule,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';
import { QuillEditorComponent } from 'ngx-quill';
import { DbFormFieldComponent } from '../db-form-field/db-form-field.component';
import { DbFileUploadFn } from '../db-file-upload/db-file-upload.types';
import {
  plainTextFromHtml,
  sanitizeRichTextHtml,
} from '../../../shared/utils/rich-text.util';
import { resolveMediaUrl } from '../../../shared/utils/media-url.util';

let dbRichTextEditorId = 0;

@Component({
  selector: 'db-rich-text-editor',
  standalone: true,
  imports: [FormsModule, DbFormFieldComponent, QuillEditorComponent],
  templateUrl: './db-rich-text-editor.component.html',
  styleUrl: './db-rich-text-editor.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DbRichTextEditorComponent),
      multi: true,
    },
  ],
})
export class DbRichTextEditorComponent implements ControlValueAccessor, OnInit {
  @ViewChild(QuillEditorComponent) quillEditor?: QuillEditorComponent;

  @Input() label = '';
  @Input() hint = '';
  @Input() error = '';
  @Input() placeholder = '';
  @Input() maxLength = 20_000;
  @Input() disabled = false;
  @Input() uploadFn?: DbFileUploadFn;

  readonly editorId = `db-rich-text-${++dbRichTextEditorId}`;
  readonly editorStyles = {
    minHeight: '220px',
  };

  value = '';
  uploadingImage = false;
  uploadError = '';
  modules: Record<string, unknown> = {};

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  ngOnInit(): void {
    this.modules = {
      toolbar: {
        container: [
          ['bold', 'italic', 'underline'],
          [{ list: 'ordered' }, { list: 'bullet' }],
          ['link', 'image'],
          ['clean'],
        ],
        handlers: {
          image: () => this.openImageUpload(),
        },
      },
    };
  }

  get charCount(): string {
    return `${plainTextFromHtml(this.value).length}/${this.maxLength}`;
  }

  writeValue(value: string | null): void {
    this.value = sanitizeRichTextHtml(value);
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  onModelChange(html: string | null | undefined): void {
    const sanitized = sanitizeRichTextHtml(html);
    this.value = sanitized;
    this.onChange(sanitized);
  }

  onBlur(): void {
    this.onTouched();
  }

  openImageUpload(): void {
    if (this.disabled || this.uploadingImage || !this.uploadFn) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;

      this.uploadingImage = true;
      this.uploadError = '';

      this.uploadFn!(file)
        .then((url) => {
          const quill = this.quillEditor?.quillEditor;
          if (!quill) return;

          const range = quill.getSelection(true);
          const index = range?.index ?? quill.getLength();
          const resolved = resolveMediaUrl(url) ?? url;
          quill.insertEmbed(index, 'image', resolved, 'user');
          quill.setSelection(index + 1);
        })
        .catch(() => {
          this.uploadError = 'No se pudo subir la imagen.';
        })
        .finally(() => {
          this.uploadingImage = false;
        });
    };
    input.click();
  }
}
