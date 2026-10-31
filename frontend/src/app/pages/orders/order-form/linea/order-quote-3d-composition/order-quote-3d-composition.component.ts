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
import {
  CostBreakdown,
  FilamentType,
  GeneralSettings,
  OrderLineDraft,
  Product,
  ProductType,
  Supply,
} from '../../../../../core/models';
import { ProductCostCalculationService } from '../../../../../core/services/product-cost-calculation.service';
import { SuppliesService } from '../../../../../core/services/settings.service';
import {
  isFdmQuoteConfigured,
  isResinQuoteLine,
} from '../../../../../shared/utils/order-fdm-quote.util';
import {
  defaultPricedResinTypeCode,
} from '../../../../../shared/utils/resin-type.util';
import { SettingsFacade } from '../../../../../store/settings/settings.facade';
import { OrderQuoteErrorMarginComponent } from '../../../../../components/order-quote-error-margin/order-quote-error-margin.component';
import { OrderQuoteFilamentsComponent } from '../../../../../components/order-quote-filaments/order-quote-filaments.component';
import { OrderQuoteLaborComponent } from '../../../../../components/order-quote-labor/order-quote-labor.component';
import { OrderQuotePrintComponent } from '../../../../../components/order-quote-print/order-quote-print.component';
import { OrderQuoteResinAlcoholComponent } from '../../../../../components/order-quote-resin-alcohol/order-quote-resin-alcohol.component';
import { OrderQuoteResinCureComponent } from '../../../../../components/order-quote-resin-cure/order-quote-resin-cure.component';
import { OrderQuoteResinMaterialComponent } from '../../../../../components/order-quote-resin-material/order-quote-resin-material.component';
import { OrderQuoteResinWashComponent } from '../../../../../components/order-quote-resin-wash/order-quote-resin-wash.component';
import {
  isOrderQuoteCatalogLocked,
  resolveOrderQuoteCureMinutes,
  resolveOrderQuoteWashMinutes,
} from '../../../../../components/order-quote-composition.util';

@Component({
  selector: 'app-order-quote-3d-composition',
  standalone: true,
  imports: [
    OrderQuoteResinMaterialComponent,
    OrderQuoteResinAlcoholComponent,
    OrderQuoteResinWashComponent,
    OrderQuoteResinCureComponent,
    OrderQuoteFilamentsComponent,
    OrderQuotePrintComponent,
    OrderQuoteLaborComponent,
    OrderQuoteErrorMarginComponent,
  ],
  templateUrl: './order-quote-3d-composition.component.html',
  styleUrl: './order-quote-3d-composition.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderQuote3dCompositionComponent implements OnInit {
  private readonly settingsFacade = inject(SettingsFacade);
  private readonly suppliesService = inject(SuppliesService);
  private readonly costCalculator = inject(ProductCostCalculationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  @Input({ required: true }) line!: OrderLineDraft;
  @Input() product: Product | null = null;
  @Input({ required: true }) lineIndex!: number;
  /** When false, Filamento/Resina toggle is hidden (line orchestrates process). */
  @Input() showProcessToggle = true;
  /**
   * Mirror of line.printProcess so OnPush re-checks when the parent toggles
   * Filamento/Resina without replacing the line object.
   */
  @Input() printProcess: 'fdm' | 'resina' | null | undefined;
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

  get catalogLocked(): boolean {
    return isOrderQuoteCatalogLocked(this.line);
  }

  get isResin(): boolean {
    return isResinQuoteLine(this.line, this.product ?? undefined);
  }

  get errorMarginPercent(): number {
    return Math.min(
      Math.max(Number(this.generalSettings?.errorMarginPercent) || 0, 0),
      100,
    );
  }

  get errorMarginCost(): number {
    return this.fdmBreakdown()?.errorMarginCost ?? 0;
  }

  get errorMarginMeta(): string {
    if (!this.generalSettings) return 'Cargando Ajustes…';
    return `${this.errorMarginPercent}% sobre material, luz y máquina`;
  }

  setPrintProcess(process: 'fdm' | 'resina'): void {
    if (this.line.productId?.trim()) return;
    if (this.line.printProcess === process) return;
    this.line.printProcess = process;
    if (process === 'resina') {
      this.line.filaments = undefined;
      this.line.filamentType = undefined;
      if (!this.line.resinType) {
        this.line.resinType = defaultPricedResinTypeCode(this.generalSettings);
      }
      this.line.washMinutes ??= 0;
      this.line.cureMinutes ??= 0;
    } else {
      this.line.resinType = undefined;
      this.line.washMinutes = undefined;
      this.line.cureMinutes = undefined;
    }
    this.changed.emit();
    this.cdr.markForCheck();
  }

  onChildChanged(): void {
    this.changed.emit();
    this.cdr.markForCheck();
  }

  private resolveResinType(): string | undefined {
    if (this.product && 'resinType' in this.product && this.product.resinType) {
      return this.product.resinType;
    }
    return this.line.resinType;
  }

  private fdmBreakdown(): CostBreakdown | null {
    if (!this.generalSettings) return null;
    const isResin = this.isResin;
    const resinType = this.resolveResinType();
    const resinReady =
      isResin &&
      !!resinType &&
      ((Number(this.line.grams) || 0) > 0 ||
        (Number(this.line.printTimeHours) || 0) > 0);
    if (!isResin && !isFdmQuoteConfigured(this.line)) return null;
    if (isResin && !resinReady) return null;

    const filamentsForQuote = isResin
      ? undefined
      : (this.line.filaments ?? []).map((row) => ({ ...row, brand: undefined }));

    return this.costCalculator.calculateCost(
      {
        type: isResin ? ProductType.RESINA : ProductType.FDM,
        grams: Number(this.line.grams) || 0,
        printTimeHours: Number(this.line.printTimeHours) || 0,
        workTimeHours: Number(this.line.workTimeHours) || 0,
        filamentType: isResin
          ? undefined
          : (this.line.filamentType as FilamentType),
        filaments: filamentsForQuote?.length ? filamentsForQuote : undefined,
        brand:
          isResin && this.product && 'brand' in this.product
            ? this.product.brand
            : undefined,
        resinType: isResin ? resinType : undefined,
        washMinutes: isResin
          ? resolveOrderQuoteWashMinutes(this.line, this.product)
          : undefined,
        cureMinutes: isResin
          ? resolveOrderQuoteCureMinutes(this.line, this.product)
          : undefined,
      },
      {
        settings: this.generalSettings,
        supplies: this.supplies.length ? this.supplies : undefined,
      },
    );
  }
}
