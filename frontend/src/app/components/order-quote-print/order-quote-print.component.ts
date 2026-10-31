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
  CostBreakdown,
  FilamentType,
  GeneralSettings,
  MachineProfileRole,
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
import { CurrencyArsPipe } from '../../shared/pipes/labels.pipe';
import { getMachineProfilesForProductType } from '../../shared/utils/machine-profile.util';
import {
  isFdmQuoteConfigured,
  isResinQuoteLine,
} from '../../shared/utils/order-fdm-quote.util';
import { SettingsFacade } from '../../store/settings/settings.facade';
import {
  formatOrderQuoteMoney,
  formatOrderQuoteNumber,
  isOrderQuoteCatalogLocked,
  resolveOrderQuoteCureMinutes,
  resolveOrderQuoteWashMinutes,
} from '../order-quote-composition.util';

@Component({
  selector: 'app-order-quote-print',
  standalone: true,
  imports: [FormsModule, DbInputComponent, CurrencyArsPipe],
  templateUrl: './order-quote-print.component.html',
  styleUrl: './order-quote-print.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderQuotePrintComponent implements OnInit {
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

  get catalogLocked(): boolean {
    return isOrderQuoteCatalogLocked(this.line);
  }

  get isResin(): boolean {
    return isResinQuoteLine(this.line, this.product ?? undefined);
  }

  get printCost(): number {
    if (this.isResin) {
      return this.resinCostParts()?.printCost ?? 0;
    }
    const breakdown = this.fdmBreakdown();
    return breakdown ? breakdown.energyCost + breakdown.machineCost : 0;
  }

  get printSummary(): string {
    const hours = Number(this.line.printTimeHours) || 0;
    const productType = this.isResin ? ProductType.RESINA : ProductType.FDM;
    const profile = this.machineProfile(productType, MachineProfileRole.PRINT);
    const parts = [
      profile?.name ?? (this.isResin ? 'Impresora resina' : 'Impresora'),
      `${formatOrderQuoteNumber(hours)} h`,
    ];
    if (this.isResin) {
      const resin = this.resinCostParts();
      if (resin) {
        parts.push(
          `luz ${formatOrderQuoteMoney(resin.printEnergyCost)} + máquina ${formatOrderQuoteMoney(resin.printMachineCost)}`,
        );
      }
    } else {
      const breakdown = this.fdmBreakdown();
      if (breakdown) {
        parts.push(
          `luz ${formatOrderQuoteMoney(breakdown.energyCost)} + máquina ${formatOrderQuoteMoney(breakdown.machineCost)}`,
        );
      }
    }
    return parts.join(' · ');
  }

  onPrintHoursChange(raw: number | string): void {
    this.line.printTimeHours = Math.max(0, Number(raw) || 0);
    this.changed.emit();
    this.cdr.markForCheck();
  }

  private machineProfile(productType: ProductType, role: MachineProfileRole) {
    if (!this.generalSettings) return undefined;
    return getMachineProfilesForProductType(
      this.generalSettings,
      productType,
    ).find((profile) => profile.role === role);
  }

  private resolveResinType(): string | undefined {
    if (this.product && 'resinType' in this.product && this.product.resinType) {
      return this.product.resinType;
    }
    return this.line.resinType;
  }

  private resinCostParts(): ResinCostParts | null {
    if (!this.generalSettings || !this.isResin) return null;
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

  private fdmBreakdown(): CostBreakdown | null {
    if (!this.generalSettings) return null;
    if (this.isResin) {
      const resinType = this.resolveResinType();
      const resinReady =
        !!resinType &&
        ((Number(this.line.grams) || 0) > 0 ||
          (Number(this.line.printTimeHours) || 0) > 0);
      if (!resinReady) return null;
      return this.costCalculator.calculateCost(
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
    if (!isFdmQuoteConfigured(this.line)) return null;
    const filamentsForQuote = (this.line.filaments ?? []).map((row) => ({
      ...row,
      brand: undefined,
    }));
    return this.costCalculator.calculateCost(
      {
        type: ProductType.FDM,
        grams: Number(this.line.grams) || 0,
        printTimeHours: Number(this.line.printTimeHours) || 0,
        workTimeHours: Number(this.line.workTimeHours) || 0,
        filamentType: this.line.filamentType as FilamentType,
        filaments: filamentsForQuote.length ? filamentsForQuote : undefined,
      },
      {
        settings: this.generalSettings,
        supplies: this.supplies.length ? this.supplies : undefined,
      },
    );
  }
}
