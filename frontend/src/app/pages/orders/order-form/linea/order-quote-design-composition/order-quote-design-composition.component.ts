import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import {
  GeneralSettings,
  OrderLineDraft,
  Product,
  ServiceProfitMargins,
  ServiceType,
} from '../../../../../core/models';
import { DbCheckboxComponent } from '../../../../../components/dashboard-form/db-checkbox/db-checkbox.component';
import { DbInputComponent } from '../../../../../components/dashboard-form/db-input/db-input.component';
import { DbSelectComponent } from '../../../../../components/dashboard-form/db-select/db-select.component';
import { DbSelectOption } from '../../../../../components/dashboard-form/db-select/db-select.types';
import { CurrencyArsPipe } from '../../../../../shared/pipes/labels.pipe';
import { FormDialogService } from '../../../../../shared/form-dialogs/public-api';
import { isGraphicDesignService } from '../../../../../shared/utils/order.helpers';
import {
  getMarginForService,
  priceFromCostAndMargin,
} from '../../../../../shared/utils/pricing.util';
import { SettingsFacade } from '../../../../../store/settings/settings.facade';
import { formatOrderQuoteNumber } from '../../../../../components/order-quote-composition.util';
import { combineLatest } from 'rxjs';

@Component({
  selector: 'app-order-quote-design-composition',
  standalone: true,
  imports: [
    FormsModule,
    DbInputComponent,
    DbSelectComponent,
    DbCheckboxComponent,
    CurrencyArsPipe,
  ],
  templateUrl: './order-quote-design-composition.component.html',
  styleUrl: './order-quote-design-composition.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderQuoteDesignCompositionComponent implements OnInit {
  private readonly settingsFacade = inject(SettingsFacade);
  private readonly formDialogs = inject(FormDialogService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  @Input({ required: true }) line!: OrderLineDraft;
  @Input() product: Product | null = null;
  @Input({ required: true }) lineIndex!: number;
  @Output() changed = new EventEmitter<void>();
  @Output() linkPrintChange = new EventEmitter<boolean>();

  private generalSettings: GeneralSettings | null = null;
  private profitMargins: ServiceProfitMargins | null = null;

  ngOnInit(): void {
    combineLatest([
      this.settingsFacade.watchGeneralSettings(),
      this.settingsFacade.profitMargins$,
    ])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([settings, margins]) => {
        this.generalSettings = settings;
        this.profitMargins = margins;
        this.cdr.markForCheck();
      });
  }

  get isGraphic(): boolean {
    return isGraphicDesignService(this.line.serviceType);
  }

  get chargeMode(): 'hours' | 'fixed' {
    if (this.line.chargeMode) return this.line.chargeMode;
    return this.isGraphic ? 'fixed' : 'hours';
  }

  get serviceRate(): number {
    if (!this.generalSettings) return 0;
    if (this.isGraphic) {
      return this.generalSettings.graphicDesignRatePerHour ?? 0;
    }
    if (this.line.serviceType === ServiceType.MODELADO) {
      return this.generalSettings.modelingRatePerHour ?? 0;
    }
    return 0;
  }

  get workKindOptions(): DbSelectOption[] {
    const kinds = this.isGraphic
      ? ['Rediseño de logo', 'Diseño de logo', 'Adaptación de archivo', 'Otro']
      : ['Pieza de repuesto', 'Modelado de producto', 'Ajuste de modelo', 'Otro'];
    return [
      { value: '', label: 'Elegí el tipo' },
      ...kinds.map((kind) => ({ value: kind, label: kind })),
    ];
  }

  get deliverableOptions(): string[] {
    return this.isGraphic
      ? ['PNG', 'SVG', 'PDF', 'AI']
      : ['STL', '3MF', 'OBJ', 'STEP'];
  }

  get workSummary(): string {
    const parts: string[] = [];
    if (this.chargeMode === 'fixed') {
      parts.push('Precio fijo');
    } else {
      parts.push(
        `${formatOrderQuoteNumber(Number(this.line.budgetedHours) || 0)} h`,
      );
    }
    if (this.line.workKind?.trim()) parts.push(this.line.workKind.trim());
    if (this.line.deliverables?.length) {
      parts.push(this.line.deliverables.join(' + '));
    }
    if (this.line.needsClientProduct) parts.push('requiere el producto');
    return parts.join(' · ');
  }

  setChargeMode(mode: 'hours' | 'fixed'): void {
    if (this.chargeMode === mode) return;

    const losesFixedPrice =
      mode === 'hours' &&
      this.chargeMode === 'fixed' &&
      ((Number(this.line.unitPrice) || 0) > 0 ||
        (Number(this.line.designUnitPrice) || 0) > 0);

    if (!losesFixedPrice) {
      this.applyChargeMode(mode);
      return;
    }

    this.formDialogs
      .openConfirm({
        title: 'Cambiar modo de cobro',
        message:
          'Al pasar a «Por horas» el precio se recalcula desde las horas presupuestadas. Se va a borrar el precio fijo cargado. ¿Continuar?',
        confirmLabel: 'Cambiar a por horas',
        cancelLabel: 'Cancelar',
        confirmVariant: 'primary',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.applyChargeMode(mode);
      });
  }

  onBudgetedHoursChange(raw: number | string): void {
    this.line.budgetedHours = Math.max(0, Number(raw) || 0);
    this.applyDesignBudget();
    this.emitChange();
  }

  onWorkKindChange(value: string): void {
    this.line.workKind = value;
    this.emitChange();
  }

  hasDeliverable(item: string): boolean {
    return (this.line.deliverables ?? []).includes(item);
  }

  toggleDeliverable(item: string): void {
    const current = this.line.deliverables ?? [];
    this.line.deliverables = current.includes(item)
      ? current.filter((entry) => entry !== item)
      : [...current, item];
    this.emitChange();
  }

  onIncludesRevisionsChange(checked: boolean): void {
    this.line.includesRevisions = checked;
    this.emitChange();
  }

  onNeedsClientProductChange(checked: boolean): void {
    this.line.needsClientProduct = checked;
    this.emitChange();
  }

  onLinkPrintToggle(checked: boolean): void {
    this.line.linkPrint = checked;
    this.linkPrintChange.emit(checked);
    this.emitChange();
  }

  private applyChargeMode(mode: 'hours' | 'fixed'): void {
    this.line.chargeMode = mode;
    if (mode === 'hours') {
      this.applyDesignBudget();
    } else {
      this.line.unitCost = 0;
    }
    this.emitChange();
  }

  private applyDesignBudget(): void {
    if (!this.profitMargins) {
      const hours = Math.max(0, Number(this.line.budgetedHours) || 0);
      this.line.budgetedHours = hours;
      this.line.unitCost =
        this.chargeMode === 'fixed' ? 0 : Math.round(this.serviceRate * hours);
      return;
    }
    const hours = Math.max(0, Number(this.line.budgetedHours) || 0);
    this.line.budgetedHours = hours;
    const cost =
      this.chargeMode === 'fixed' ? 0 : Math.round(this.serviceRate * hours);
    this.line.unitCost = cost;
    const price = priceFromCostAndMargin(
      cost,
      getMarginForService(this.line.serviceType, this.profitMargins),
    );
    this.line.unitPrice = price;
    this.line.designUnitPrice = price;
  }

  private emitChange(): void {
    this.changed.emit();
    this.cdr.markForCheck();
  }
}
