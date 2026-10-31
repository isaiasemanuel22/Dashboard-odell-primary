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
  ProductType,
  Supply,
} from '../../core/models';
import {
  ProductCostCalculationService,
  ResinCostParts,
} from '../../core/services/product-cost-calculation.service';
import { SuppliesService } from '../../core/services/settings.service';
import { DbInputComponent } from '../dashboard-form/db-input/db-input.component';
import { DbSelectComponent } from '../dashboard-form/db-select/db-select.component';
import { DbSelectOption } from '../dashboard-form/db-select/db-select.types';
import { CurrencyArsPipe } from '../../shared/pipes/labels.pipe';
import { resolveResinPricePerLiter } from '../../shared/utils/material-type-price.util';
import { isResinQuoteLine } from '../../shared/utils/order-fdm-quote.util';
import {
  buildResinTypeOptions,
  resinTypeDisplayLabel,
} from '../../shared/utils/resin-type.util';
import { SettingsFacade } from '../../store/settings/settings.facade';
import {
  formatOrderQuoteMoney,
  formatOrderQuoteNumber,
  isOrderQuoteCatalogLocked,
  resolveOrderQuoteCureMinutes,
  resolveOrderQuoteWashMinutes,
} from '../order-quote-composition.util';

@Component({
  selector: 'app-order-quote-resin-material',
  standalone: true,
  imports: [FormsModule, DbInputComponent, DbSelectComponent, CurrencyArsPipe],
  templateUrl: './order-quote-resin-material.component.html',
  styleUrl: './order-quote-resin-material.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderQuoteResinMaterialComponent implements OnInit {
  private readonly settingsFacade = inject(SettingsFacade);
  private readonly suppliesService = inject(SuppliesService);
  private readonly costCalculator = inject(ProductCostCalculationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  @Input({ required: true }) line!: OrderLineDraft;
  @Input() product: Product | null = null;
  @Input({ required: true }) lineIndex!: number;
  @Output() changed = new EventEmitter<void>();

  private generalSettings: GeneralSettings | null = null;
  private supplies: Supply[] = [];

  ngOnInit(): void {
    this.settingsFacade
      .watchGeneralSettings()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((settings) => {
        this.generalSettings = settings;
        this.cdr.markForCheck();
      });
    this.suppliesService
      .watchSupplies()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((items) => {
        this.supplies = items;
        this.cdr.markForCheck();
      });
  }

  get visible(): boolean {
    return isResinQuoteLine(this.line, this.product ?? undefined);
  }

  get catalogLocked(): boolean {
    return isOrderQuoteCatalogLocked(this.line);
  }

  get resinTypeOptions(): DbSelectOption[] {
    const extras = this.line.resinType ? [this.line.resinType] : [];
    const options = buildResinTypeOptions(
      this.generalSettings?.resinTypes ?? [],
      this.generalSettings?.resinPrices ?? [],
      extras,
      'code',
    );
    return options.map((option) => ({
      ...option,
      label: this.resinTypeOptionLabel(String(option.value), option.label),
    }));
  }

  get materialSummary(): string {
    const grams = Number(this.line.grams) || 0;
    const typeKey = this.resolveResinType();
    const catalog = this.generalSettings?.resinTypes ?? [];
    const resinType = typeKey
      ? resinTypeDisplayLabel(String(typeKey), catalog)
      : 'Resina';
    const brand =
      this.product && 'brand' in this.product && this.product.brand?.trim()
        ? this.product.brand.trim()
        : null;
    const parts = [`${formatOrderQuoteNumber(grams)} ml`, resinType];
    if (brand) parts.push(brand);
    return parts.join(' · ');
  }

  get resinCost(): number {
    return this.resinCostParts()?.resinCost ?? 0;
  }

  onResinTypeChange(value: string): void {
    this.line.resinType = value;
    this.line.printProcess = 'resina';
    this.changed.emit();
    this.cdr.markForCheck();
  }

  onGramsChange(raw: number | string): void {
    this.line.grams = Math.max(0, Number(raw) || 0);
    this.changed.emit();
    this.cdr.markForCheck();
  }

  private resinCostParts(): ResinCostParts | null {
    if (!this.generalSettings || !this.visible) return null;
    const resinType = this.resolveResinType();
    if (!resinType) return null;
    return this.costCalculator.buildResinCostParts(
      {
        type: ProductType.RESINA,
        grams: Number(this.line.grams) || 0,
        printTimeHours: Number(this.line.printTimeHours) || 0,
        workTimeHours: Number(this.line.workTimeHours) || 0,
        brand:
          this.product && 'brand' in this.product
            ? this.product.brand
            : undefined,
        resinType,
        washMinutes: resolveOrderQuoteWashMinutes(this.line, this.product),
        cureMinutes: resolveOrderQuoteCureMinutes(this.line, this.product),
      },
      {
        settings: this.generalSettings,
        supplies: this.supplies.length ? this.supplies : undefined,
      },
    );
  }

  private resolveResinType(): string | undefined {
    if (this.product && 'resinType' in this.product && this.product.resinType) {
      return this.product.resinType;
    }
    return this.line.resinType;
  }

  private resinTypeOptionLabel(type: string, fallback: string): string {
    if (!this.generalSettings) return fallback;
    const catalog = this.generalSettings.resinTypes ?? [];
    const typeLabel = resinTypeDisplayLabel(type, catalog) || fallback;
    const perLiter = resolveResinPricePerLiter(this.generalSettings, type);
    if (perLiter == null) return `${typeLabel} · falta precio`;
    return `${typeLabel} · ${formatOrderQuoteMoney(perLiter)}/L`;
  }
}
