import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
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
import { SettingsService } from '../../../core/services/settings.service';
import { MobileDockAction } from '../../../components/mobile-dock/mobile-dock.component';
import {
  DEFAULT_WHATSAPP_TEMPLATES,
  WHATSAPP_TEMPLATE_VARIABLES,
} from '../../../shared/constants/whatsapp-template.constants';
import { extractApiErrorMessage } from '../../../shared/utils/api-error';
import { KeepTypingDirective } from '../../../shared/directives/keep-typing.directive';
import {
  SettingsEditBaseline,
  SettingsUnsavedChanges,
} from '../settings-unsaved-changes';

/** Plantilla en edición. `id` vacío = nueva (la crea el servidor al guardar). */
interface TemplateDraft {
  key: string;
  id: string;
  name: string;
  body: string;
  builtIn: boolean;
}

interface IntegrationsDraft {
  feePercent: number | null;
  pointOfSale: number | null;
  annualCap: number | null;
  businessPhone: string;
  templates: TemplateDraft[];
}

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
  private readonly breakpoint = inject(BreakpointService);
  private readonly cdr = inject(ChangeDetectorRef);
  private settingsSub?: Subscription;
  private readonly editBaseline = new SettingsEditBaseline();
  private nextKey = 0;
  readonly warnOnDesktop = true;
  private lastSelection: { start: number; end: number } | null = null;

  @ViewChild('bodyArea') private bodyArea?: ElementRef<HTMLTextAreaElement>;

  readonly isMobile = this.breakpoint.isMobile;
  readonly variables = WHATSAPP_TEMPLATE_VARIABLES;

  draft: IntegrationsDraft | null = null;
  editingKey: string | null = null;
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
  }

  ngOnDestroy(): void {
    this.settingsSub?.unsubscribe();
  }

  hasUnsavedChanges(): boolean {
    if (!this.draft) return false;
    return this.editBaseline.isDirty(this.editState());
  }

  get editingTemplate(): TemplateDraft | null {
    return this.draft?.templates.find((t) => t.key === this.editingKey) ?? null;
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

  toggleEdit(template: TemplateDraft): void {
    this.editingKey = this.editingKey === template.key ? null : template.key;
  }

  addTemplate(): void {
    if (!this.draft) return;
    const template: TemplateDraft = {
      key: `new-${++this.nextKey}`,
      id: '',
      name: '',
      body: '',
      builtIn: false,
    };
    this.draft.templates = [...this.draft.templates, template];
    this.editingKey = template.key;
  }

  removeTemplate(template: TemplateDraft): void {
    if (!this.draft || template.builtIn) return;
    this.draft.templates = this.draft.templates.filter(
      (t) => t.key !== template.key,
    );
    if (this.editingKey === template.key) this.editingKey = null;
  }

  /** Guarda la selección del textarea al perder el foco (los chips la usan). */
  rememberSelection(area: HTMLTextAreaElement): void {
    this.lastSelection = {
      start: area.selectionStart ?? area.value.length,
      end: area.selectionEnd ?? area.selectionStart ?? area.value.length,
    };
  }

  /** Inserta `{variable}` donde estaba el cursor del cuerpo de la plantilla. */
  insertVariable(key: string): void {
    const template = this.editingTemplate;
    if (!template) return;
    const area = this.bodyArea?.nativeElement;
    const body = template.body;
    const sel = this.lastSelection;
    const start = Math.min(sel?.start ?? body.length, body.length);
    const end = Math.min(sel?.end ?? start, body.length);
    const before = body.slice(0, start);
    const needsSpace = before.length > 0 && !/\s$/.test(before);
    const token = `${needsSpace ? ' ' : ''}{${key}}`;
    template.body = before + token + body.slice(end);
    const caret = start + token.length;
    this.lastSelection = { start: caret, end: caret };
    queueMicrotask(() => {
      if (!area) return;
      area.value = template.body;
      area.focus();
      area.setSelectionRange(caret, caret);
    });
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
      whatsapp: {
        businessPhone: draft.businessPhone.trim(),
        templates: draft.templates.map((t) => ({
          ...(t.id ? { id: t.id } : {}),
          name: t.name.trim(),
          body: t.body,
        })),
      },
    };
    this.saving = true;
    this.setMessage('', false);
    this.settingsService.updateIntegrations(payload).subscribe({
      next: (saved) => {
        this.saving = false;
        this.editingKey = null;
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
    for (const t of draft.templates) {
      if (!t.name.trim()) {
        this.editingKey = t.key;
        return 'Cada plantilla necesita un nombre';
      }
      if (!t.body.trim()) {
        this.editingKey = t.key;
        return `La plantilla «${t.name.trim()}» no tiene mensaje`;
      }
    }
    return '';
  }

  private applySaved(saved: IntegrationsSettings | undefined): void {
    const templates = saved?.whatsapp?.templates ?? [
      ...DEFAULT_WHATSAPP_TEMPLATES,
    ];
    this.draft = {
      feePercent: saved?.mercadoPago?.feePercent ?? 0,
      pointOfSale: saved?.arca?.pointOfSale ?? null,
      annualCap: saved?.arca?.annualCap ?? null,
      businessPhone: saved?.whatsapp?.businessPhone ?? '',
      templates: templates.map((t) => ({
        key: t.id,
        id: t.id,
        name: t.name,
        body: t.body,
        builtIn: t.builtIn,
      })),
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
      businessPhone: d.businessPhone,
      templates: d.templates.map((t) => [t.id, t.name, t.body]),
    };
  }

  private setMessage(text: string, isError: boolean): void {
    this.message = text;
    this.messageIsError = isError;
    this.cdr.markForCheck();
  }
}
