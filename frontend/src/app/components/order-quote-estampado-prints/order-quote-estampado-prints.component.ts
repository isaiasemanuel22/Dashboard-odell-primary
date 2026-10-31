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
import { ImpresoWithCost, OrderLineDraft, Product } from '../../core/models';
import { ImpresosService } from '../../core/services/impresos.service';
import { PrintSpecListComponent } from '../dynamic-lists/print-spec-list/print-spec-list.component';
import { PAPER_TYPE_LABELS } from '../../shared/constants/labels';
import { CurrencyArsPipe } from '../../shared/pipes/labels.pipe';
import {
  normalizeEstampadoPrints,
  printQuantity,
  resolvePrintDimensions,
} from '../../shared/utils/estampado.helpers';
import { isOrderQuoteCatalogLocked } from '../order-quote-composition.util';

@Component({
  selector: 'app-order-quote-estampado-prints',
  standalone: true,
  imports: [FormsModule, PrintSpecListComponent, CurrencyArsPipe],
  templateUrl: './order-quote-estampado-prints.component.html',
  styleUrl: './order-quote-estampado-prints.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderQuoteEstampadoPrintsComponent implements OnInit {
  private readonly impresosService = inject(ImpresosService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  @Input({ required: true }) line!: OrderLineDraft;
  @Input() product: Product | null = null;
  @Input({ required: true }) lineIndex!: number;
  @Input() printsCost = 0;
  @Output() changed = new EventEmitter<void>();

  private impresos: ImpresoWithCost[] = [];

  ngOnInit(): void {
    this.impresosService
      .getImpresos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((items) => {
        this.impresos = items;
        this.cdr.markForCheck();
      });
  }

  get catalogLocked(): boolean {
    return isOrderQuoteCatalogLocked(this.line);
  }

  get printsSummary(): string {
    const prints = normalizeEstampadoPrints(this.line.estampadoPrints).filter(
      (print) =>
        !!resolvePrintDimensions(print, (id) =>
          this.impresos.find((item) => item.id === id),
        ),
    );
    if (!prints.length) return 'Sin impresos';
    const count = prints.reduce((sum, print) => sum + printQuantity(print), 0);
    const papers = [
      ...new Set(
        prints
          .map((print) => print.paperType)
          .filter(Boolean)
          .map((type) => PAPER_TYPE_LABELS[type!] ?? type),
      ),
    ];
    const noun = count === 1 ? 'impreso' : 'impresos';
    return [`${count} ${noun}`, ...papers].join(' · ');
  }

  onChange(): void {
    this.changed.emit();
    this.cdr.markForCheck();
  }
}
