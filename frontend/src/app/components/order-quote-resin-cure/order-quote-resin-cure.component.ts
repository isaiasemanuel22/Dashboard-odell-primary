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
import { isResinQuoteLine } from '../../shared/utils/order-fdm-quote.util';
import { SettingsFacade } from '../../store/settings/settings.facade';
import {
  formatOrderQuoteNumber,
  isOrderQuoteCatalogLocked,
  resolveOrderQuoteCureMinutes,
  resolveOrderQuoteWashMinutes,
} from '../order-quote-composition.util';

@Component({
  selector: 'app-order-quote-resin-cure',
  standalone: true,
  imports: [FormsModule, DbInputComponent, CurrencyArsPipe],
  templateUrl: './order-quote-resin-cure.component.html',
  styleUrl: './order-quote-resin-cure.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderQuoteResinCureComponent implements OnInit {
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

  get catalogLocked(): boolean {
    return isOrderQuoteCatalogLocked(this.line);
  }

  get cureMinutes(): number {
    return resolveOrderQuoteCureMinutes(this.line, this.product);
  }

  get cureSummary(): string {
    const minutes = this.cureMinutes;
    const profile = this.machineProfile(MachineProfileRole.CURE);
    return `${profile?.name ?? 'Curadora'} · ${formatOrderQuoteNumber(minutes)} min`;
  }

  get cureMachineCost(): number {
    return this.resinCostParts()?.cureMachineCost ?? 0;
  }

  onCureMinutesChange(raw: number | string): void {
    this.line.cureMinutes = Math.max(0, Number(raw) || 0);
    this.changed.emit();
    this.cdr.markForCheck();
  }

  private machineProfile(role: MachineProfileRole) {
    if (!this.generalSettings) return undefined;
    return getMachineProfilesForProductType(
      this.generalSettings,
      ProductType.RESINA,
    ).find((profile) => profile.role === role);
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
