import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WhatsAppTemplate } from '../../core/models';
import { DbButtonComponent } from '@general-components';
import {
  renderWhatsAppTemplate,
  WhatsAppTemplateVars,
  whatsAppMessageUrl,
} from '../../shared/utils/whatsapp-template.util';
import { whatsAppDigitsAr } from '../../shared/utils/quote-share.util';

export interface WhatsAppNotifySent {
  template: WhatsAppTemplate;
  via: 'open' | 'copy';
}

/**
 * «Avisar por WhatsApp»: elige plantilla, muestra el mensaje con las variables
 * ya reemplazadas y lo abre en wa.me o lo copia. El padre registra el envío.
 */
@Component({
  selector: 'app-whatsapp-notify',
  standalone: true,
  imports: [FormsModule, DbButtonComponent],
  templateUrl: './whatsapp-notify.component.html',
  styleUrl: './whatsapp-notify.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WhatsAppNotifyComponent implements OnChanges {
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() templates: WhatsAppTemplate[] = [];
  @Input({ required: true }) vars!: WhatsAppTemplateVars;
  @Input() phone: string | null = null;
  @Input() defaultTemplateId: string | null = null;
  /** Texto bajo los botones (ej. «Se registra en el historial del pedido»). */
  @Input() footnote = '';
  /** Sin título interno cuando el padre ya lo pone (acordeón mobile). */
  @Input() showTitle = true;
  @Input() selectId = 'wa-template';
  @Output() sent = new EventEmitter<WhatsAppNotifySent>();

  selectedId = '';
  copied = false;
  private copiedTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['templates'] && !changes['defaultTemplateId']) return;
    const has = (id: string | null) =>
      !!id && this.templates.some((tpl) => tpl.id === id);
    if (changes['defaultTemplateId'] || !has(this.selectedId)) {
      this.selectedId = has(this.defaultTemplateId)
        ? (this.defaultTemplateId as string)
        : (this.templates[0]?.id ?? '');
    }
  }

  get hasPhone(): boolean {
    return !!whatsAppDigitsAr(this.phone);
  }

  get selected(): WhatsAppTemplate | null {
    return this.templates.find((tpl) => tpl.id === this.selectedId) ?? null;
  }

  get message(): string {
    const template = this.selected;
    return template ? renderWhatsAppTemplate(template.body, this.vars) : '';
  }

  get canSend(): boolean {
    return this.hasPhone && !!this.selected && !!this.message;
  }

  open(): void {
    const template = this.selected;
    if (!template || !this.canSend) return;
    window.open(whatsAppMessageUrl(this.phone, this.message), '_blank', 'noopener');
    this.sent.emit({ template, via: 'open' });
  }

  async copy(): Promise<void> {
    const template = this.selected;
    if (!template || !this.message) return;
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
    this.sent.emit({ template, via: 'copy' });
  }
}
