import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { DbButtonComponent } from '@general-components';
import { ChatMessage } from '../core/models';
import {
  MetaService,
  WhatsAppTemplatePreview,
  WhatsAppTemplateTarget,
} from '../core/services/meta.service';
import { extractApiErrorMessage } from '../shared/utils/api-error';
import { FormDialogShellComponent } from './form-dialog-shell/form-dialog-shell.component';

export type WhatsAppTemplateDialogData = WhatsAppTemplateTarget;

/** Elegir y mandar una plantilla aprobada de WhatsApp (§28.2). Devuelve el mensaje enviado. */
@Component({
  standalone: true,
  imports: [FormDialogShellComponent, DbButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    @use '../shared/styles/variables' as *;

    .tpl-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin: 0;
      padding: 0 0 24px;
      border: 0;
      min-width: 0;
    }

    .tpl-list .tpl-option {
      display: flex;
      flex-direction: row;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 12px;
      border: 1px solid $color-border;
      border-radius: 10px;
      font-size: 14px;
      cursor: pointer;
      box-sizing: border-box;

      // Más específico que \`.modal input\` / \`.modal label\` (estilos globales de formularios).
      input[type='radio'] {
        flex: none;
        width: 20px;
        height: 20px;
        margin: 0;
        padding: 0;
        box-shadow: none;
      }
    }

    .tpl-list .tpl-option--checked {
      border-color: $color-primary;
      background: $color-primary-bg;
    }

    .tpl-list .tpl-option--disabled {
      cursor: default;
      opacity: 0.7;
    }

    .tpl-body {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
    }

    .tpl-label {
      font-weight: 600;
    }

    .tpl-preview {
      padding: 8px 10px;
      border-radius: 12px 12px 12px 2px;
      background: $color-status-success-bg;
      color: $color-status-success-text;
      font-size: 13px;
      overflow-wrap: anywhere;
    }

    .tpl-error,
    .tpl-hint {
      margin: 0;
      color: $color-text-label;
      font-size: 13px;
    }

    .tpl-send-error {
      margin: 0 0 12px;
      color: $color-danger-text;
      font-size: 13px;
    }
  `,
  template: `
    <app-form-dialog-shell
      title="Mandar plantilla de WhatsApp"
      size="sm"
      [footerBar]="true"
      (close)="cancel()"
    >
      @if (loadError()) {
        <p class="tpl-send-error" role="alert">{{ loadError() }}</p>
      } @else if (!previews()) {
        <p class="tpl-hint">Cargando…</p>
      } @else {
        <fieldset class="tpl-list">
          <legend class="tpl-hint">
            Sale aunque pasaron más de 24 h desde el último mensaje del cliente.
          </legend>
          @for (preview of previews(); track preview.key) {
            <label
              class="tpl-option"
              [class.tpl-option--checked]="selected() === preview.key"
              [class.tpl-option--disabled]="!preview.text"
            >
              <input
                type="radio"
                name="whatsappTemplate"
                [value]="preview.key"
                [checked]="selected() === preview.key"
                [disabled]="!preview.text"
                (change)="selected.set(preview.key)"
              />
              <span class="tpl-body">
                <span class="tpl-label">{{ preview.label }}</span>
                @if (preview.text) {
                  <span class="tpl-preview">{{ preview.text }}</span>
                } @else {
                  <span class="tpl-error">{{ preview.error }}</span>
                }
              </span>
            </label>
          }
        </fieldset>
      }
      @if (sendError()) {
        <p class="tpl-send-error" role="alert">{{ sendError() }}</p>
      }
      <db-button
        modalFooter
        label="Cancelar"
        variant="secondary"
        format="soft"
        (clicked)="cancel()"
      />
      <db-button
        modalFooter
        label="Mandar"
        variant="primary"
        format="solid"
        [disabled]="!selected() || sending()"
        (clicked)="send()"
      />
    </app-form-dialog-shell>
  `,
})
export class WhatsAppTemplateDialogComponent {
  private readonly dialogRef = inject(DialogRef<ChatMessage | undefined>);
  private readonly metaService = inject(MetaService);
  readonly data = inject<WhatsAppTemplateDialogData>(DIALOG_DATA);

  readonly previews = signal<WhatsAppTemplatePreview[] | null>(null);
  readonly loadError = signal('');
  readonly selected = signal('');
  readonly sending = signal(false);
  readonly sendError = signal('');

  constructor() {
    this.metaService.previewTemplates(this.data).subscribe({
      next: (previews) => this.previews.set(previews),
      error: (err) =>
        this.loadError.set(
          extractApiErrorMessage(err, 'No se pudieron cargar las plantillas'),
        ),
    });
  }

  cancel(): void {
    this.dialogRef.close(undefined);
  }

  send(): void {
    const key = this.selected();
    if (!key || this.sending()) return;
    this.sending.set(true);
    this.sendError.set('');
    this.metaService.sendTemplate(key, this.data).subscribe({
      next: (message) => this.dialogRef.close(message),
      error: (err) => {
        this.sending.set(false);
        this.sendError.set(
          extractApiErrorMessage(err, 'No se pudo mandar la plantilla'),
        );
      },
    });
  }
}
