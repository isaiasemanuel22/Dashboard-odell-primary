import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GeneralSettings, ServiceType } from '../../../core/models';
import { SettingsService } from '../../../core/services/settings.service';
import { SERVICE_TYPE_LABELS } from '../../../shared/constants/labels';
import { normalizeProfitMargins } from '../../../shared/utils/pricing.util';
import {
  DbFormComponent,
  DbFormGridComponent,
  DbInputComponent,
  DbStateMessageComponent,
  DbButtonComponent,
} from '@general-components';

interface MarginField {
  service: ServiceType;
  label: string;
  hint: string;
}

@Component({
  selector: 'app-profit-settings',
  standalone: true,
  imports: [
    DecimalPipe,
    FormsModule,
    DbFormComponent,
    DbFormGridComponent,
    DbInputComponent,
    DbStateMessageComponent,
    DbButtonComponent,
  ],
  templateUrl: './profit-settings.component.html',
  styleUrl: './profit-settings.component.scss',
})
export class ProfitSettingsComponent implements OnInit {
  private readonly settingsService = inject(SettingsService);
  private readonly cdr = inject(ChangeDetectorRef);

  settings: GeneralSettings | null = null;
  saving = false;
  message = '';

  readonly marginFields: MarginField[] = [
    {
      service: ServiceType.IMPRESION_3D,
      label: SERVICE_TYPE_LABELS[ServiceType.IMPRESION_3D],
      hint: 'Aplica a productos FDM y resina.',
    },
    {
      service: ServiceType.ESTAMPADO,
      label: SERVICE_TYPE_LABELS[ServiceType.ESTAMPADO],
      hint: 'Aplica a productos de estampado.',
    },
    {
      service: ServiceType.DISENO,
      label: SERVICE_TYPE_LABELS[ServiceType.DISENO],
      hint: 'Referencia para servicios de diseño en pedidos.',
    },
  ];

  ngOnInit(): void {
    this.loadSettings();
  }

  marginValue(service: ServiceType): number {
    if (!this.settings) return 0;
    return this.settings.profitMargins[service];
  }

  setMargin(service: ServiceType, value: number | string): void {
    if (!this.settings) return;
    const parsed = Number(value);
    this.settings = {
      ...this.settings,
      profitMargins: {
        ...this.settings.profitMargins,
        [service]: Number.isFinite(parsed) ? parsed : 0,
      },
    };
  }

  examplePrice(cost: number, margin: number): number {
    const markup = Math.min(Math.max(margin, 0), 999);
    if (cost <= 0) return 0;
    if (markup === 0) return cost;
    return Math.round(cost * (1 + markup / 100));
  }

  loadSettings(): void {
    this.settingsService.getGeneralSettings(true).subscribe((settings) => {
      this.settings = {
        ...structuredClone(settings),
        profitMargins: normalizeProfitMargins(settings.profitMargins),
      };
      this.cdr.markForCheck();
    });
  }

  saveMargins(): void {
    if (!this.settings) return;

    const profitMargins = normalizeProfitMargins(this.settings.profitMargins);
    this.settings.profitMargins = profitMargins;

    for (const field of this.marginFields) {
      const value = profitMargins[field.service];
      if (value < 0 || value > 999) {
        this.message = `El margen de ${field.label} debe estar entre 0 y 999 %`;
        return;
      }
    }

    this.saving = true;
    this.message = '';

    this.settingsService
      .updateGeneralSettings({
        profitMargins,
      })
      .subscribe({
        next: (saved) => {
          this.settings = structuredClone(saved);
          this.saving = false;
          this.message = 'Márgenes guardados correctamente';
          this.cdr.markForCheck();
        },
        error: () => {
          this.saving = false;
          this.message = 'Error al guardar los márgenes';
          this.cdr.markForCheck();
        },
      });
  }
}
