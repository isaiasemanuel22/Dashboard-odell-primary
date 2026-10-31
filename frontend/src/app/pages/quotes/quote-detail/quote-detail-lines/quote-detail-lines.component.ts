import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Quote, QuoteItem } from '../../../../core/models';
import {
  DB_DATA_TABLE,
  OdlColumn,
} from '@general-components';
import {
  calculateLinePriceTotal,
  calculateOrderDiscount,
  calculateOrderSubtotal,
  isDesignService,
} from '../../../../shared/utils/order.helpers';
import { formatFdmFilamentsSummary } from '../../../../shared/utils/fdm.helpers';
import { isImpresion3DLine } from '../../../../shared/utils/order-fdm-quote.util';
import { resolveLinePrintUnitPrice } from '../../../../shared/utils/design-print.util';
import { DEPOSIT_FACTOR } from '../../../../shared/utils/quote-document.util';
import { SERVICE_TYPE_LABELS } from '../../../../shared/constants/labels';
import { CurrencyArsPipe } from '../../../../shared/pipes/labels.pipe';

@Component({
  selector: 'app-quote-detail-lines',
  standalone: true,
  imports: [RouterLink, CurrencyArsPipe, ...DB_DATA_TABLE],
  templateUrl: './quote-detail-lines.component.html',
  styleUrl: './quote-detail-lines.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
})
export class QuoteDetailLinesComponent {
  @Input({ required: true }) quote!: Quote;

  readonly isDesignService = isDesignService;
  readonly depositPercent = Math.round(DEPOSIT_FACTOR * 100);
  readonly lineColumns: OdlColumn<QuoteItem>[] = [
    { key: 'service', header: 'Servicio', value: (item) => SERVICE_TYPE_LABELS[item.serviceType] },
    { key: 'product', header: 'Concepto / producto' },
    { key: 'quantity', header: 'Cant.', type: 'number' },
    { key: 'unitPrice', header: 'Precio unit.' },
    { key: 'subtotal', header: 'Subtotal', type: 'money', value: (item) => this.lineSubtotal(item) },
  ];

  get quoteSubtotal(): number {
    return calculateOrderSubtotal(this.quote.items);
  }

  get quoteDiscount(): number {
    return calculateOrderDiscount(
      this.quote.items,
      this.quote.discountPercent,
      this.quote.discountAmount,
    );
  }

  get discountLabel(): string {
    const percent = this.quote.discountPercent ?? 0;
    if (percent > 0) {
      const formatted = percent.toLocaleString('es-AR', {
        maximumFractionDigits: 2,
      });
      return `Descuento ${formatted}%`;
    }
    return 'Descuento';
  }

  get depositAmount(): number {
    return Math.round(this.quote.total * DEPOSIT_FACTOR);
  }

  fdmItemSpecs(item: QuoteItem): string {
    if (!isImpresion3DLine(item.serviceType)) return '';
    return formatFdmFilamentsSummary(item);
  }

  itemPrintHours(item: QuoteItem): number | null {
    const hours = Number(item.printTimeHours);
    return Number.isFinite(hours) && hours > 0 ? hours : null;
  }

  formatPrintHours(hours: number): string {
    return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(hours);
  }

  lineSubtotal(item: QuoteItem): number {
    return calculateLinePriceTotal(item);
  }

  printUnitPrice(item: QuoteItem): number {
    return resolveLinePrintUnitPrice(item);
  }
}
