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
  FdmFilamentLine,
  FilamentType,
  GeneralSettings,
  OrderLineDraft,
  Product,
  ProductType,
  Supply,
} from '../../core/models';
import { ProductCostCalculationService } from '../../core/services/product-cost-calculation.service';
import { SuppliesService } from '../../core/services/settings.service';
import { FilamentLineListComponent } from './filament-line-list.component';
import { FILAMENT_TYPE_LABELS } from '../../shared/constants/labels';
import { CurrencyArsPipe } from '../../shared/pipes/labels.pipe';
import {
  createEmptyFdmFilamentLine,
  normalizeFdmFilaments,
  totalFdmFilamentGrams,
} from '../../shared/utils/fdm.helpers';
import {
  isFdmQuoteConfigured,
  isResinQuoteLine,
} from '../../shared/utils/order-fdm-quote.util';
import { SettingsFacade } from '../../store/settings/settings.facade';
import {
  formatOrderQuoteNumber,
  isOrderQuoteCatalogLocked,
  resolveOrderQuoteCureMinutes,
  resolveOrderQuoteWashMinutes,
} from '../order-quote-composition.util';

@Component({
  selector: 'app-order-quote-filaments',
  standalone: true,
  imports: [FormsModule, FilamentLineListComponent, CurrencyArsPipe],
  templateUrl: './order-quote-filaments.component.html',
  styleUrl: './order-quote-filaments.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderQuoteFilamentsComponent implements OnInit {
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
    return !isResinQuoteLine(this.line, this.product ?? undefined);
  }

  get catalogLocked(): boolean {
    return isOrderQuoteCatalogLocked(this.line);
  }

  get quoteFilaments(): FdmFilamentLine[] {
    if (!this.line.filaments?.length) {
      const restored = normalizeFdmFilaments(undefined, {
        grams: this.line.grams,
        filamentType: this.line.filamentType,
      });
      this.line.filaments = restored.length
        ? restored
        : [createEmptyFdmFilamentLine(this.line.filamentType ?? FilamentType.PLA)];
    }
    return this.line.filaments;
  }

  get filamentSummary(): string {
    const rows = this.line.filaments ?? [];
    const active = rows.filter((row) => Number(row.grams) > 0);
    const counted = active.length ? active : rows;
    const count = counted.length || 1;
    const grams = rows.length
      ? totalFdmFilamentGrams(rows)
      : Number(this.line.grams) || 0;
    const types = [
      ...new Set(counted.map((row) => row.filamentType).filter(Boolean)),
    ];
    const typeLabel = types.length
      ? types.map((type) => FILAMENT_TYPE_LABELS[type]).join(' · ')
      : this.line.filamentType
        ? FILAMENT_TYPE_LABELS[this.line.filamentType]
        : 'Sin material';
    const noun = count === 1 ? 'filamento' : 'filamentos';
    return `${count} ${noun} · ${formatOrderQuoteNumber(grams)} g · ${typeLabel}`;
  }

  get materialCost(): number {
    return this.fdmBreakdown()?.materialCost ?? 0;
  }

  onFilamentsChange(filaments: FdmFilamentLine[]): void {
    this.line.filaments = filaments;
    this.line.grams = totalFdmFilamentGrams(filaments);
    this.line.filamentType = filaments.find(
      (item) => item.filamentType,
    )?.filamentType;
    this.changed.emit();
    this.cdr.markForCheck();
  }

  private fdmBreakdown(): CostBreakdown | null {
    if (!this.generalSettings || !isFdmQuoteConfigured(this.line)) return null;
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
        washMinutes: resolveOrderQuoteWashMinutes(this.line, this.product),
        cureMinutes: resolveOrderQuoteCureMinutes(this.line, this.product),
      },
      {
        settings: this.generalSettings,
        supplies: this.supplies.length ? this.supplies : undefined,
      },
    );
  }
}
