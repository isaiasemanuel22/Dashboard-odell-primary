import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DbButtonComponent } from '@general-components';
import {
  MetaService,
  WhatsAppTemplatePreview,
  WhatsAppTemplateTarget,
} from '../../core/services/meta.service';
import { extractApiErrorMessage } from '../../shared/utils/api-error';
import { whatsAppDigitsAr } from '../../shared/utils/quote-share.util';

export interface WhatsAppNotifySent {
  /** Clave de la plantilla de Meta (§28.2). */
  templateKey: string;
  templateLabel: string;
  via: 'send' | 'copy';
}

/**
 * «Avisar por WhatsApp» (§29.2): elige una plantilla de Meta, muestra el
 * mensaje armado con los datos del pedido o presupuesto y lo envía por la
 * Cloud API (queda en Chats) o lo copia. El padre registra el envío.
 */
@Component({
  selector: 'app-whatsapp-notify',
  standalone: true,
  imports: [FormsModule, DbButtonComponent],
  templateUrl: './whatsapp-notify.component.html',
  styleUrl: './whatsapp-notify.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WhatsAppNotifyComponent implements OnChanges, OnDestroy {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly metaService = inject(MetaService);

  /** Pedido o presupuesto al que se avisa (el cliente sale de ahí). */
  @Input() orderId?: string;
  @Input() quoteId?: string;
  @Input() phone: string | null = null;
  /** Clave de la plantilla que arranca elegida. */
  @Input() defaultTemplateKey: string | null = null;
  /** Cambia cuando cambian los datos del pedido: se vuelve a armar el mensaje. */
  @Input() refresh: unknown = null;
  /** Texto bajo los botones (ej. «Se registra en el historial del pedido»). */
  @Input() footnote = '';
  /** Sin título interno cuando el padre ya lo pone (acordeón mobile). */
  @Input() showTitle = true;
  @Input() selectId = 'wa-template';
  @Output() sent = new EventEmitter<WhatsAppNotifySent>();

  previews: WhatsAppTemplatePreview[] = [];
  selectedKey = '';
  loading = true;
  loadError = '';
  /** null = todavía no se sabe. */
  channelConnected: boolean | null = null;
  private channelRequested = false;
  sending = false;
  sendError = '';
  sentOk = false;
  copied = false;
  private copiedTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['orderId'] || changes['quoteId'] || changes['refresh']) {
      this.loadPreviews();
    } else if (changes['defaultTemplateKey']) {
      this.pickDefault(true);
    }
    if (this.channelConnected === null && !this.channelRequested) {
      this.loadChannel();
    }
  }

  ngOnDestroy(): void {
    if (this.copiedTimer) clearTimeout(this.copiedTimer);
  }

  private get target(): WhatsAppTemplateTarget {
    return {
      ...(this.orderId ? { orderId: this.orderId } : {}),
      ...(this.quoteId ? { quoteId: this.quoteId } : {}),
    };
  }

  get hasPhone(): boolean {
    return !!whatsAppDigitsAr(this.phone);
  }

  get selected(): WhatsAppTemplatePreview | null {
    return this.previews.find((p) => p.key === this.selectedKey) ?? null;
  }

  get message(): string {
    return this.selected?.text ?? '';
  }

  /** Por qué no se puede enviar (vacío si se puede). */
  get blockReason(): string {
    if (this.channelConnected === false) {
      return 'El canal de WhatsApp no está conectado. Revisalo en Ajustes → Integraciones. Podés copiar el mensaje.';
    }
    if (!this.hasPhone) {
      return 'Este cliente no tiene teléfono cargado: no se puede enviar por WhatsApp. Podés copiar el mensaje.';
    }
    const selected = this.selected;
    if (selected && !selected.text && selected.error) {
      return selected.error;
    }
    return '';
  }

  get canSend(): boolean {
    return (
      !this.loading &&
      !this.sending &&
      !!this.message &&
      this.channelConnected === true &&
      this.hasPhone
    );
  }

  selectTemplate(key: string): void {
    this.selectedKey = key;
    this.sendError = '';
    this.sentOk = false;
  }

  send(): void {
    const selected = this.selected;
    if (!selected || !this.canSend) return;
    this.sending = true;
    this.sendError = '';
    this.sentOk = false;
    this.metaService.sendTemplate(selected.key, this.target).subscribe({
      next: () => {
        this.sending = false;
        this.sentOk = true;
        this.cdr.markForCheck();
        this.sent.emit({
          templateKey: selected.key,
          templateLabel: selected.label,
          via: 'send',
        });
      },
      error: (err) => {
        this.sending = false;
        this.sendError = extractApiErrorMessage(
          err,
          'No se pudo enviar el mensaje por WhatsApp',
        );
        this.cdr.markForCheck();
      },
    });
  }

  async copy(): Promise<void> {
    const selected = this.selected;
    if (!selected || !this.message) return;
    try {
      await navigator.clipboard.writeText(this.message);
    } catch {
      const area = document.createElement('textarea');
      area.value = this.message;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    this.copied = true;
    if (this.copiedTimer) clearTimeout(this.copiedTimer);
    this.copiedTimer = setTimeout(() => {
      this.copied = false;
      this.cdr.markForCheck();
    }, 2000);
    this.cdr.markForCheck();
    this.sent.emit({
      templateKey: selected.key,
      templateLabel: selected.label,
      via: 'copy',
    });
  }

  private loadPreviews(): void {
    this.loading = true;
    this.loadError = '';
    this.cdr.markForCheck();
    this.metaService.previewTemplates(this.target).subscribe({
      next: (previews) => {
        this.previews = previews;
        this.loading = false;
        this.pickDefault(false);
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.previews = [];
        this.loading = false;
        this.loadError = extractApiErrorMessage(
          err,
          'No se pudieron cargar las plantillas de WhatsApp',
        );
        this.cdr.markForCheck();
      },
    });
  }

  private loadChannel(): void {
    this.channelRequested = true;
    this.metaService.status().subscribe({
      next: (status) => {
        this.channelConnected = status.whatsapp.connected;
        this.cdr.markForCheck();
      },
      // Sin saber el estado, el envío queda bloqueado: mejor que mandar a ciegas.
      error: () => {
        this.channelConnected = false;
        this.cdr.markForCheck();
      },
    });
  }

  private pickDefault(force: boolean): void {
    const usable = (key: string | null) =>
      !!key && this.previews.some((p) => p.key === key && !!p.text);
    if (!force && usable(this.selectedKey)) return;
    const fallback = this.previews.find((p) => !!p.text)?.key ?? '';
    this.selectedKey = usable(this.defaultTemplateKey)
      ? (this.defaultTemplateKey as string)
      : fallback || (this.previews[0]?.key ?? '');
  }
}
