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
import { normalizeEstampadoSupplies } from '../../shared/utils/estampado.helpers';
import {
  formatOrderQuoteNumber,
  isOrderQuoteCatalogLocked,
} from '../order-quote-composition.util';

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

  get catalogLocked(): boolean {
    return isOrderQuoteCatalogLocked(this.line);
  }

  get suppliesInfo(): { text: string; missingPrice: boolean } {
    const entries = normalizeEstampadoSupplies(this.line.estampadoSupplies);
    if (!entries.length) return { text: 'Sin insumos', missingPrice: false };
    let missingPrice = false;
    const text = entries
      .map((entry) => {
        const supply = this.supplies.find((item) => item.id === entry.supplyId);
        if (!supply || !(Number(supply.unitPrice) > 0)) missingPrice = true;
        return `${supply?.name ?? 'Insumo'} × ${formatOrderQuoteNumber(entry.quantity)}`;
      })
      .join(' · ');
    return { text, missingPrice };
  }

  onChange(): void {
    this.changed.emit();
    this.cdr.markForCheck();
  }
}
