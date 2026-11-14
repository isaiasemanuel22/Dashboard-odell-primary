import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Quote } from '../../core/models';
import { CurrencyArsPipe } from '../../shared/pipes/labels.pipe';
import {
  formatQuoteMobileContextHint,
  quoteLinesMetaLabel,
  quoteStatusLabelFor,
  quoteStatusPillClass,
} from '../../shared/utils/quote.helpers';
import { isQuoteExpired } from '../../shared/utils/quote-validity.util';

@Component({
  selector: 'app-quote-mobile-card',
  standalone: true,
  imports: [RouterLink, CurrencyArsPipe],
  templateUrl: './quote-mobile-card.component.html',
  styleUrl: './quote-mobile-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuoteMobileCardComponent {
  readonly quote = input.required<Quote>();

  protected readonly metaLabel = computed(() => quoteLinesMetaLabel(this.quote()));

  protected readonly statusLabel = computed(
    () => quoteStatusLabelFor(this.quote()),
  );

  protected readonly statusPillClass = computed(() =>
    quoteStatusPillClass(this.quote().status, isQuoteExpired(this.quote())),
  );

  protected readonly customerLabel = computed(() => {
    const name = this.quote().customerName?.trim();
    return name || 'Sin cliente';
  });

  protected readonly wholesalePill = computed((): string | null => {
    const quote = this.quote();
    if (!quote.wholesaleApplied) return null;
    const percent = wholesalePercentFromItems(quote);
    if (percent != null && percent > 0) return `Mayorista −${percent}%`;
    return 'Mayorista';
  });

  protected readonly contextHint = computed(() =>
    formatQuoteMobileContextHint(this.quote()),
  );

  protected readonly accessibleName = computed(() => {
    const quote = this.quote();
    const total = new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(Number(quote.total) || 0);
    return `${quote.id}, ${this.customerLabel()}, ${this.statusLabel()}, ${total}`;
  });
}

function wholesalePercentFromItems(quote: Quote): number | null {
  for (const item of quote.items) {
    const list = Number(item.listUnitPrice);
    const unit = Number(item.unitPrice);
    if (
      Number.isFinite(list) &&
      list > 0 &&
      Number.isFinite(unit) &&
      unit < list
    ) {
      return Math.round((1 - unit / list) * 100);
    }
  }
  return null;
}
