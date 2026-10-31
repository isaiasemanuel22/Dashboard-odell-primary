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
  GeneralSettings,
  ImpresoWithCost,
  OrderLineDraft,
  Product,
  ProductType,
  Supply,
} from '../../../../../core/models';
import { ImpresosService } from '../../../../../core/services/impresos.service';
import { ProductCostCalculationService } from '../../../../../core/services/product-cost-calculation.service';
import { SuppliesService } from '../../../../../core/services/settings.service';
import {
  normalizeEstampadoPrints,
  normalizeEstampadoSupplies,
  printQuantity,
  resolvePrintDimensions,
  totalEstampadoPressMinutes,
} from '../../../../../shared/utils/estampado.helpers';
import { calculateMachineOverhead } from '../../../../../shared/utils/machine-profile.util';
import { SettingsFacade } from '../../../../../store/settings/settings.facade';
import { OrderQuoteErrorMarginComponent } from '../../../../../components/order-quote-error-margin/order-quote-error-margin.component';
import { OrderQuoteEstampadoPressComponent } from '../../../../../components/order-quote-estampado-press/order-quote-estampado-press.component';
import { OrderQuoteEstampadoPrintsComponent } from '../../../../../components/order-quote-estampado-prints/order-quote-estampado-prints.component';
import { OrderQuoteEstampadoSuppliesComponent } from '../../../../../components/order-quote-estampado-supplies/order-quote-estampado-supplies.component';
import { OrderQuoteLaborComponent } from '../../../../../components/order-quote-labor/order-quote-labor.component';
import { isOrderQuoteCatalogLocked } from '../../../../../components/order-quote-composition.util';

export interface OrderQuoteEstampadoCosts {
  prints: number;
  supplies: number;
  press: number;
  labor: number;
  errorMargin: number;
  pressMinutes: number;
  energy: number;
  machine: number;
}

@Component({
  selector: 'app-order-quote-estampado-composition',
  standalone: true,
  imports: [
    OrderQuoteEstampadoPrintsComponent,
    OrderQuoteEstampadoSuppliesComponent,
    OrderQuoteEstampadoPressComponent,
    OrderQuoteLaborComponent,
    OrderQuoteErrorMarginComponent,
  ],
  templateUrl: './order-quote-estampado-composition.component.html',
  styleUrl: './order-quote-estampado-composition.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderQuoteEstampadoCompositionComponent implements OnInit {
  private readonly settingsFacade = inject(SettingsFacade);
  private readonly impresosService = inject(ImpresosService);
  private readonly suppliesService = inject(SuppliesService);
  private readonly costCalculator = inject(ProductCostCalculationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  @Input({ required: true }) line!: OrderLineDraft;
  @Input() product: Product | null = null;
  @Input({ required: true }) lineIndex!: number;
  @Output() changed = new EventEmitter<void>();

  private generalSettings: GeneralSettings | null = null;
  private impresos: ImpresoWithCost[] = [];
  private supplies: Supply[] = [];

  ngOnInit(): void {
    this.settingsFacade
      .watchGeneralSettings()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((settings) => {
        this.generalSettings = settings;
        this.cdr.markForCheck();
      });
    this.impresosService
      .getImpresos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((items) => {
        this.impresos = items;
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

  get errorMarginPercent(): number {
    return Math.min(
      Math.max(Number(this.generalSettings?.errorMarginPercent) || 0, 0),
      100,
    );
  }

  get errorMarginMeta(): string {
    if (!this.generalSettings) return 'Cargando Ajustes…';
    return `${this.errorMarginPercent}% sobre impresos, insumos y plancha`;
  }

  get costs(): OrderQuoteEstampadoCosts {
    return this.estampadoCosts();
  }

  onChildChanged(): void {
    this.changed.emit();
    this.cdr.markForCheck();
  }

  private estampadoCosts(): OrderQuoteEstampadoCosts {
    const settings = this.generalSettings;
    const pressMinutes = totalEstampadoPressMinutes(this.line.estampadoPressCycles);
    if (!settings) {
      return {
        prints: 0,
        supplies: 0,
        press: 0,
        labor: 0,
        errorMargin: 0,
        pressMinutes,
        energy: 0,
        machine: 0,
      };
    }
    const prints = normalizeEstampadoPrints(this.line.estampadoPrints).reduce(
      (sum, print) => {
        const dims = resolvePrintDimensions(print, (id) =>
          this.impresos.find((item) => item.id === id),
        );
        if (!dims) return sum;
        return (
          sum +
          this.costCalculator.calculateImpresoPaperCost(
            settings,
            dims.paperType,
            dims.widthCm,
            dims.heightCm,
          ) *
            printQuantity(print)
        );
      },
      0,
    );
    const supplies = normalizeEstampadoSupplies(this.line.estampadoSupplies).reduce(
      (sum, entry) => {
        const supply = this.supplies.find((item) => item.id === entry.supplyId);
        return supply
          ? sum + (Number(supply.unitPrice) || 0) * (Number(entry.quantity) || 0)
          : sum;
      },
      0,
    );
    const overhead = calculateMachineOverhead(settings, ProductType.ESTAMPADO, {
      printTimeHours: 0,
      pressMinutes,
    });
    const laborHours = Number(this.line.workTimeHours) || 0;
    const laborRate = Number(settings.laborCostPerHour) || 0;
    const labor = Math.round(laborHours * laborRate);
    const percent = this.errorMarginPercent;
    const errorMargin = percent
      ? Math.round(
          (prints + supplies + overhead.energyCost + overhead.machineCost) *
            (percent / 100),
        )
      : 0;
    return {
      prints: Math.round(prints),
      supplies: Math.round(supplies),
      press: overhead.energyCost + overhead.machineCost,
      labor,
      errorMargin,
      pressMinutes,
      energy: overhead.energyCost,
      machine: overhead.machineCost,
    };
  }
}
