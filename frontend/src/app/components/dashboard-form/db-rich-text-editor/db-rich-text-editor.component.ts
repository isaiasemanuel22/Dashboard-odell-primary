import {
  Component,
  forwardRef,
  Input,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import {
  ControlValueAccessor,
  FormsModule,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';
import { QuillEditorComponent } from 'ngx-quill';
import Quill from 'quill';
import { DbFormFieldComponent } from '../db-form-field/db-form-field.component';
import { DbFileUploadFn } from '../db-file-upload/db-file-upload.types';
import {
  plainTextFromHtml,
  richTextEquivalent,
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
export class DbRichTextEditorComponent
  implements ControlValueAccessor, OnInit, OnDestroy
{
  @ViewChild(QuillEditorComponent) quillEditor?: QuillEditorComponent;

  @Input() label = '';
  @Input() hint = '';
  @Input() error = '';
  @Input() placeholder = '';
  @Input() maxLength = 1_000;
  @Input() disabled = false;
  @Input() uploadFn?: DbFileUploadFn;

  readonly editorId = `db-rich-text-${++dbRichTextEditorId}`;
  readonly editorStyles = {
    minHeight: '220px',
  };

  value = '';
  uploadingImage = false;
  private pendingUploads = 0;
  uploadError = '';
  modules: Record<string, unknown> = {};

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  private quillRoot: HTMLElement | null = null;
  private onPasteCapture: ((e: ClipboardEvent) => void) | null = null;
  private onDropCapture: ((e: DragEvent) => void) | null = null;

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

  ngOnDestroy(): void {
    if (!this.quillRoot) return;
    if (this.onPasteCapture) {
      this.quillRoot.removeEventListener('paste', this.onPasteCapture, true);
    }
    if (this.onDropCapture) {
      this.quillRoot.removeEventListener('drop', this.onDropCapture, true);
    }
    this.quillRoot = null;
    this.onPasteCapture = null;
    this.onDropCapture = null;
  }

  get plainLength(): number {
    return plainTextFromHtml(this.value).length;
  }

  get isOverLimit(): boolean {
    return this.plainLength > this.maxLength;
  }

  get charCount(): string {
    return `${this.plainLength.toLocaleString('es-AR')} / ${this.maxLength.toLocaleString('es-AR')}`;
  }

  get fieldHint(): string {
    return this.hint;
  }

  get fieldError(): string {
    if (this.error) return this.error;
    if (this.uploadError) return this.uploadError;
    if (this.isOverLimit) {
      return `La descripción no puede superar los ${this.maxLength.toLocaleString('es-AR')} caracteres.`;
    }
    return '';
  }

  writeValue(value: string | null): void {
    const incoming = value ?? '';
    // No sanitizar acá: normalizar &nbsp; reescribe el DOM de Quill y mueve el cursor.
    if (richTextEquivalent(this.value, incoming)) {
      return;
    }
    this.value = incoming;
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
    // Pasar el HTML de Quill tal cual mientras se edita. Sanitizar/nbsp → espacio
    // en cada keystroke hace que ngModel reescriba el editor y el cursor vuelva a 0.
    const next = html ?? '';
    this.value = next;
    this.onChange(next);
  }

  onBlur(): void {
    const sanitized = sanitizeRichTextHtml(this.value);
    if (sanitized !== this.value) {
      this.value = sanitized;
      this.onChange(sanitized);
    }
    this.onTouched();
  }

  onEditorCreated(quill: Quill): void {
    // Descartar IMG base64 pegadas como HTML (con o sin uploadFn).
    const Delta = Quill.import('delta');
    const clipboard = quill.getModule('clipboard') as {
      addMatcher: (
        selector: string,
        matcher: (node: Node, delta: InstanceType<typeof Delta>) => InstanceType<typeof Delta>,
      ) => void;
    };
    clipboard.addMatcher('IMG', (node, delta) => {
      const src = (node as HTMLImageElement).getAttribute?.('src') ?? '';
      if (src.startsWith('data:')) {
        return new Delta();
      }
      return delta;
    });

    if (!this.uploadFn) return;

    this.quillRoot = quill.root;
    this.onPasteCapture = (e: ClipboardEvent) => this.handlePaste(e);
    this.onDropCapture = (e: DragEvent) => this.handleDrop(e, quill);
    quill.root.addEventListener('paste', this.onPasteCapture, true);
    quill.root.addEventListener('drop', this.onDropCapture, true);
  }

  openImageUpload(): void {
    if (this.disabled || this.uploadingImage || !this.uploadFn) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      this.uploadAndInsert(file);
    };
    input.click();
  }

  /** Sube con uploadFn e inserta el embed en el cursor. */
  private uploadAndInsert(file: File): void {
    if (this.disabled || !this.uploadFn) return;

    this.pendingUploads++;
    this.uploadingImage = true;
    this.uploadError = '';

    this.uploadFn(file)
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
        this.pendingUploads--;
        this.uploadingImage = this.pendingUploads > 0;
      });
  }

  private handlePaste(e: ClipboardEvent): void {
    const images = this.imageFilesFrom(e.clipboardData);
    if (!images.length) return;

    e.preventDefault();
    e.stopPropagation();
    for (const file of images) {
      this.uploadAndInsert(file);
    }
  }

  private handleDrop(e: DragEvent, quill: Quill): void {
    const images = this.imageFilesFrom(e.dataTransfer);
    if (!images.length) return;

    e.preventDefault();
    e.stopPropagation();
    this.setCursorFromPoint(quill, e.clientX, e.clientY);
    for (const file of images) {
      this.uploadAndInsert(file);
    }
  }

  private imageFilesFrom(
    data: DataTransfer | null | undefined,
  ): File[] {
    if (!data?.files?.length) return [];
    return Array.from(data.files).filter((f) => f.type.startsWith('image/'));
  }

  /** Mueve el cursor al punto del drop si el browser lo permite. */
  private setCursorFromPoint(
    quill: Quill,
    clientX: number,
    clientY: number,
  ): void {
    let native: Range | null = null;
    if (document.caretRangeFromPoint) {
      native = document.caretRangeFromPoint(clientX, clientY);
    } else {
      const doc = document as Document & {
        caretPositionFromPoint?: (
          x: number,
          y: number,
        ) => { offsetNode: Node; offset: number } | null;
      };
      const position = doc.caretPositionFromPoint?.(clientX, clientY);
      if (position) {
        native = document.createRange();
        native.setStart(position.offsetNode, position.offset);
        native.setEnd(position.offsetNode, position.offset);
      }
    }
    if (!native) return;

    try {
      const normalized = quill.selection.normalizeNative(native);
      if (!normalized) return;
      const range = quill.selection.normalizedToRange(normalized);
      quill.setSelection(range.index, 0);
    } catch {
      // Si no se puede mapear el punto, se usa la selección actual.
    }
  }
}
