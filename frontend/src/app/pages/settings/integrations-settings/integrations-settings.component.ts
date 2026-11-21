import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import {
  DbButtonComponent,
  DbInputComponent,
  DbStateMessageComponent,
  MobileFieldGroupComponent,
  MobileSettingsPageComponent,
} from '@general-components';
import {
  IntegrationsSettings,
  UpdateIntegrationsPayload,
} from '../../../core/models';
import { BreakpointService } from '../../../core/services/breakpoint.service';
import { MetaService, MetaStatus } from '../../../core/services/meta.service';
import { SettingsService } from '../../../core/services/settings.service';
import { MobileDockAction } from '../../../components/mobile-dock/mobile-dock.component';
import { extractApiErrorMessage } from '../../../shared/utils/api-error';
import { KeepTypingDirective } from '../../../shared/directives/keep-typing.directive';
import {
  SettingsEditBaseline,
  SettingsUnsavedChanges,
} from '../settings-unsaved-changes';

interface ChannelCard {
  key: 'whatsapp' | 'instagram' | 'messenger';
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

interface IntegrationsDraft {
  feePercent: number | null;
  pointOfSale: number | null;
  annualCap: number | null;
}

/**
 * Ajustes → Integraciones (§29.1): conexión con Meta (§28.1, solo lectura:
 * los ids y tokens van en variables de entorno) y las tarjetas editables de
 * Mercado Pago y ARCA, más Tiendanube sin conectar.
 */
@Component({
  selector: 'app-integrations-settings',
  standalone: true,
  imports: [
    FormsModule,
    NgTemplateOutlet,
    KeepTypingDirective,
    DbButtonComponent,
    DbInputComponent,
    DbStateMessageComponent,
    MobileFieldGroupComponent,
    MobileSettingsPageComponent,
  ],
  templateUrl: './integrations-settings.component.html',
  styleUrl: './integrations-settings.component.scss',
})
export class IntegrationsSettingsComponent
  implements OnInit, OnDestroy, SettingsUnsavedChanges
{
  private readonly settingsService = inject(SettingsService);
  private readonly metaService = inject(MetaService);
  private readonly breakpoint = inject(BreakpointService);
  private readonly cdr = inject(ChangeDetectorRef);
  private settingsSub?: Subscription;
  private readonly editBaseline = new SettingsEditBaseline();
  private messageTimer: ReturnType<typeof setTimeout> | null = null;
  readonly warnOnDesktop = true;

  readonly isMobile = this.breakpoint.isMobile;

  draft: IntegrationsDraft | null = null;
  metaStatus: MetaStatus | null = null;
  channels: ChannelCard[] = [];
  metaLoading = true;
  metaError = '';
  copyNotice = '';
  saving = false;
  message = '';
  messageIsError = false;

  ngOnInit(): void {
    this.settingsSub = this.settingsService
      .watchGeneralSettings()
      .subscribe((settings) => {
        if (!settings || this.saving) return;
        if (this.hasUnsavedChanges()) return;
        this.applySaved(settings.integrations);
        this.cdr.markForCheck();
      });
    this.settingsService.getGeneralSettings(false).subscribe();
    this.loadMeta();
  }

  ngOnDestroy(): void {
    this.settingsSub?.unsubscribe();
    if (this.messageTimer) clearTimeout(this.messageTimer);
  }

  hasUnsavedChanges(): boolean {
    if (!this.draft) return false;
    return this.editBaseline.isDirty(this.editState());
  }

  get mobileDockActions(): MobileDockAction[] {
    return [
      {
        id: 'save',
        label: this.saving ? 'Guardando…' : 'Guardar',
        kind: 'primary',
        disabled: this.saving,
      },
    ];
  }

  onMobileDockAction(id: string): void {
    if (id === 'save') this.save();
  }

  setNumber(
    field: 'feePercent' | 'pointOfSale' | 'annualCap',
    value: number | string | null,
  ): void {
    if (!this.draft) return;
    this.draft[field] =
      value === null || value === '' || !Number.isFinite(Number(value))
        ? null
        : Number(value);
  }

  templateStatus(metaStatus: string | null): { label: string; tone: PillTone } {
    if (!metaStatus) return { label: 'Sin dar de alta', tone: 'neutral' };
    return TEMPLATE_STATUS[metaStatus] ?? { label: metaStatus, tone: 'neutral' };
  }

  copyWebhookUrl(): void {
    if (!this.metaStatus) return;
    try {
      void navigator.clipboard.writeText(this.metaStatus.webhookUrl).then(
        () => this.flashCopy('URL copiada'),
        () => this.flashCopy('No se pudo copiar'),
      );
    } catch {
      this.flashCopy('No se pudo copiar');
    }
  }

  save(): void {
    if (!this.draft || this.saving) return;
    const error = this.validate(this.draft);
    if (error) {
      this.setMessage(error, true);
      return;
    }
    const draft = this.draft;
    const payload: UpdateIntegrationsPayload = {
      mercadoPago: { feePercent: draft.feePercent ?? 0 },
      arca: { pointOfSale: draft.pointOfSale, annualCap: draft.annualCap },
    };
    this.saving = true;
    this.setMessage('', false);
    this.settingsService.updateIntegrations(payload).subscribe({
      next: (saved) => {
        this.saving = false;
        this.applySaved(saved);
        this.setMessage('Integraciones guardadas correctamente', false);
      },
      error: (err) => {
        this.saving = false;
        this.setMessage(
          extractApiErrorMessage(err, 'Error al guardar las integraciones'),
          true,
        );
      },
    });
  }

  private validate(draft: IntegrationsDraft): string {
    const fee = draft.feePercent ?? 0;
    if (fee < 0 || fee > 99.99) {
      return 'La comisión debe estar entre 0 y 99,99 %';
    }
    const pos = draft.pointOfSale;
    if (pos !== null && (!Number.isInteger(pos) || pos < 1 || pos > 99999)) {
      return 'El punto de venta debe ser un número entero de hasta 5 dígitos';
    }
    if (draft.annualCap !== null && draft.annualCap < 0) {
      return 'El tope anual no puede ser negativo';
    }
    return '';
  }

  private applySaved(saved: IntegrationsSettings | undefined): void {
    this.draft = {
      feePercent: saved?.mercadoPago?.feePercent ?? 0,
      pointOfSale: saved?.arca?.pointOfSale ?? null,
      annualCap: saved?.arca?.annualCap ?? null,
    };
    this.editBaseline.capture(this.editState());
    this.cdr.markForCheck();
  }

  private editState(): unknown {
    const d = this.draft;
    if (!d) return null;
    return {
      feePercent: d.feePercent,
      pointOfSale: d.pointOfSale,
      annualCap: d.annualCap,
    };
  }

  private setMessage(text: string, isError: boolean): void {
    this.message = text;
    this.messageIsError = isError;
    this.cdr.markForCheck();
  }

  private loadMeta(): void {
    this.metaService.status().subscribe({
      next: (status) => {
        this.metaStatus = status;
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
        this.metaLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.metaError = extractApiErrorMessage(
          err,
          'No se pudo leer la conexión con Meta',
        );
        this.metaLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  private flashCopy(text: string): void {
    this.copyNotice = text;
    if (this.messageTimer) clearTimeout(this.messageTimer);
    this.messageTimer = setTimeout(() => {
      this.copyNotice = '';
      this.messageTimer = null;
      this.cdr.markForCheck();
    }, 3000);
    this.cdr.markForCheck();
  }
}
