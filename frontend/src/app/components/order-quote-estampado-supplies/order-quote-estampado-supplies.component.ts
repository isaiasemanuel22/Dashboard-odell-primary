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
import { OrderLineDraft, Product, Supply } from '../../core/models';
import { SuppliesService } from '../../core/services/settings.service';
import { SupplyLineListComponent } from '../dynamic-lists/supply-line-list/supply-line-list.component';
import { CurrencyArsPipe } from '../../shared/pipes/labels.pipe';
import { SupplyLineMode, suppliesForMode } from '../../shared/utils/supply-line-value.util';
import { lineSuppliesForDisplay } from '../../shared/utils/order-fdm-quote.util';
import { normalizeEstampadoSupplies } from '../../shared/utils/estampado.helpers';
import {
  formatOrderQuoteNumber,
  isOrderQuoteCatalogLocked,
} from '../order-quote-composition.util';

const NO_PACKAGING: NonNullable<OrderLineDraft['packagingSupplies']> = [];

@Component({
  selector: 'app-order-quote-estampado-supplies',
  standalone: true,
  imports: [FormsModule, SupplyLineListComponent, CurrencyArsPipe],
  templateUrl: './order-quote-estampado-supplies.component.html',
  styleUrl: './order-quote-estampado-supplies.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderQuoteEstampadoSuppliesComponent implements OnInit {
  private readonly suppliesService = inject(SuppliesService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  @Input({ required: true }) line!: OrderLineDraft;
  @Input() product: Product | null = null;
  @Input({ required: true }) lineIndex!: number;
  /** «packaging»: edita `line.packagingSupplies` (editable también en catálogo, §27.3). */
  @Input() mode: SupplyLineMode = 'supplies';
  @Input() suppliesCost = 0;
  @Output() changed = new EventEmitter<void>();

  private supplies: Supply[] = [];

  ngOnInit(): void {
    this.suppliesService
      .watchSupplies()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((items) => {
        this.supplies = items;
        this.cdr.markForCheck();
      });
  }

  get isPackaging(): boolean {
    return this.mode === 'packaging';
  }

  get title(): string {
    return this.isPackaging ? 'Packaging' : 'Insumos';
  }

  get catalogLocked(): boolean {
    // El packaging de una línea de catálogo se puede quitar, cambiar o agregar (§27.3).
    return !this.isPackaging && isOrderQuoteCatalogLocked(this.line);
  }

  get suppliesInfo(): { text: string; missingPrice: boolean } {
    const entries = normalizeEstampadoSupplies(this.displayedSupplies);
    if (!entries.length) {
      return {
        text: this.isPackaging ? 'Sin packaging' : 'Sin insumos',
        missingPrice: false,
      };
    }
    let missingPrice = false;
    const text = entries
      .map((entry) => {
        const supply = this.supplies.find((item) => item.id === entry.supplyId);
        if (!supply || !(Number(supply.unitPrice) > 0)) missingPrice = true;
        return `${supply?.name ?? (this.isPackaging ? 'Packaging' : 'Insumo')} × ${formatOrderQuoteNumber(entry.quantity)}`;
      })
      .join(' · ');
    return { text, missingPrice };
  }

  /** Insumos propios de la línea o, en un combo, los del combo (solo lectura). */
  get displayedSupplies() {
    if (this.isPackaging) return this.line.packagingSupplies ?? NO_PACKAGING;
    return lineSuppliesForDisplay(this.line, this.product);
  }

  onSuppliesChange(value: OrderLineDraft['estampadoSupplies']): void {
    if (this.isPackaging) {
      this.line.packagingSupplies = value;
    } else if (!this.catalogLocked) {
      this.line.estampadoSupplies = value;
    }
    this.onChange();
  }

  onChange(): void {
    this.changed.emit();
    this.cdr.markForCheck();
  }
}
