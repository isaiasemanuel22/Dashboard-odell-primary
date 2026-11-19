import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  DbButtonComponent,
  DbInputComponent,
  MobileSettingsPageComponent,
} from '@general-components';
import { BreakpointService } from '../../../core/services/breakpoint.service';
import { MetaService, MetaStatus } from '../../../core/services/meta.service';
import { extractApiErrorMessage } from '../../../shared/utils/api-error';

interface ChannelCard {
  key: string;
  logo: string;
  name: string;
  connected: boolean;
  detail: string;
}

type PillTone = 'ok' | 'warn' | 'danger' | 'neutral';

const TEMPLATE_STATUS: Record<string, { label: string; tone: PillTone }> = {
  APPROVED: { label: 'Aprobada', tone: 'ok' },
  PENDING: { label: 'En revisión', tone: 'warn' },
  REJECTED: { label: 'Rechazada', tone: 'danger' },
  PAUSED: { label: 'Pausada', tone: 'warn' },
  DISABLED: { label: 'Desactivada', tone: 'danger' },
};

/** Conexión con Meta (§28.1): solo lectura, los ids y tokens van en variables de entorno. */
@Component({
  selector: 'app-integrations-settings',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    FormsModule,
    DbButtonComponent,
    DbInputComponent,
    MobileSettingsPageComponent,
  ],
  templateUrl: './integrations-settings.component.html',
  styleUrl: './integrations-settings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IntegrationsSettingsComponent implements OnInit, OnDestroy {
  private readonly metaService = inject(MetaService);
  private readonly breakpoint = inject(BreakpointService);
  private readonly cdr = inject(ChangeDetectorRef);
  private messageTimer: ReturnType<typeof setTimeout> | null = null;

  readonly isMobile = this.breakpoint.isMobile;

  status: MetaStatus | null = null;
  channels: ChannelCard[] = [];
  loading = true;
  error = '';
  message = '';

  ngOnInit(): void {
    this.metaService.status().subscribe({
      next: (status) => {
        this.status = status;
        this.channels = [
          {
            key: 'whatsapp',
            logo: 'WA',
            name: 'WhatsApp',
            connected: status.whatsapp.connected,
            detail:
              status.whatsapp.displayPhoneNumber ??
              (status.whatsapp.phoneNumberId
                ? `Número ${status.whatsapp.phoneNumberId}`
                : 'Falta WHATSAPP_PHONE_NUMBER_ID'),
          },
          {
            key: 'instagram',
            logo: 'IG',
            name: 'Instagram',
            connected: status.instagram.connected,
            detail: status.instagram.accountId
              ? `Cuenta ${status.instagram.accountId}`
              : 'Falta INSTAGRAM_ACCOUNT_ID',
          },
          {
            key: 'messenger',
            logo: 'FB',
            name: 'Messenger',
            connected: status.messenger.connected,
            detail: status.messenger.pageId
              ? `Página ${status.messenger.pageId}`
              : 'Falta META_PAGE_ID',
          },
        ];
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error = extractApiErrorMessage(
          err,
          'No se pudo leer la conexión con Meta',
        );
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  ngOnDestroy(): void {
    this.clearMessageTimer();
  }

  templateStatus(metaStatus: string | null): { label: string; tone: PillTone } {
    if (!metaStatus) return { label: 'Sin dar de alta', tone: 'neutral' };
    return TEMPLATE_STATUS[metaStatus] ?? { label: metaStatus, tone: 'neutral' };
  }

  copyWebhookUrl(): void {
    if (!this.status) return;
    try {
      void navigator.clipboard.writeText(this.status.webhookUrl).then(
        () => this.flashMessage('URL copiada'),
        () => this.flashMessage('No se pudo copiar'),
      );
    } catch {
      this.flashMessage('No se pudo copiar');
    }
  }

  private flashMessage(text: string): void {
    this.message = text;
    this.clearMessageTimer();
    this.messageTimer = setTimeout(() => {
      this.message = '';
      this.messageTimer = null;
      this.cdr.markForCheck();
    }, 3000);
    this.cdr.markForCheck();
  }

  private clearMessageTimer(): void {
    if (this.messageTimer) {
      clearTimeout(this.messageTimer);
      this.messageTimer = null;
    }
  }
}
