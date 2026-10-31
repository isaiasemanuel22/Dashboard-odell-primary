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
import { RouterLink } from '@angular/router';
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
import { CurrencyArsPipe } from '../../shared/pipes/labels.pipe';
import { isResinQuoteLine } from '../../shared/utils/order-fdm-quote.util';
import { SettingsFacade } from '../../store/settings/settings.facade';
import {
  formatOrderQuoteNumber,
  resolveOrderQuoteCureMinutes,
  resolveOrderQuoteWashMinutes,
} from '../order-quote-composition.util';

@Component({
  selector: 'app-order-quote-resin-alcohol',
  standalone: true,
  imports: [RouterLink, CurrencyArsPipe],
  templateUrl: './order-quote-resin-alcohol.component.html',
  styleUrl: './order-quote-resin-alcohol.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderQuoteResinAlcoholComponent implements OnInit {
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
      .watchUntilDestroyed(this.destroyRef)
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

  get unlinked(): boolean {
    return this.resinCostParts()?.washSupplyStatus === 'no-profile';
  }

  get washSupplyCost(): number {
    return this.resinCostParts()?.washSupplyCost ?? 0;
  }

  get alcoholSummary(): string {
    const parts = this.resinCostParts();
    if (!parts) return 'Lavado · alcohol';
    if (parts.washSupplyStatus === 'no-profile') return '';
    const bits: string[] = [];
    if (parts.washSupplyName) bits.push(parts.washSupplyName);
    if (parts.washConsumptionMl > 0) {
      bits.push(
        `${formatOrderQuoteNumber(parts.washConsumptionMl)} ml / ${parts.washBathUses} usos`,
      );
    }
    return bits.length ? bits.join(' · ') : 'Insumo de lavado';
  }

  get alcoholIssue(): string | null {
    const parts = this.resinCostParts();
    if (!parts || parts.washSupplyCost > 0) return null;
    switch (parts.washSupplyStatus) {
      case 'no-profile':
        return 'Vinculá el insumo en la máquina de lavado (Ajustes → valores generales).';
      case 'missing-supply':
        return 'El insumo vinculado a la máquina de lavado no está en Insumos.';
      case 'missing-price':
        return 'El alcohol de lavado no tiene precio. Completalo en Insumos.';
      case 'no-consumption':
        return 'Falta el consumo de alcohol (ml por baño) en Ajustes → valores generales.';
      default:
        return null;
    }
  }

  get needsInsumos(): boolean {
    const parts = this.resinCostParts();
    if (!parts || parts.washSupplyCost > 0) return false;
    return (
      parts.washSupplyStatus === 'missing-supply' ||
      parts.washSupplyStatus === 'missing-price'
    );
  }

  get needsAjustes(): boolean {
    const parts = this.resinCostParts();
    if (!parts || parts.washSupplyCost > 0) return false;
    return (
      parts.washSupplyStatus === 'no-profile' ||
      parts.washSupplyStatus === 'no-consumption'
    );
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
}
