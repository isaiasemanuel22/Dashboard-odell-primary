import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Quote } from '../../core/models';
import { QUOTE_STATUS_LABELS } from '../../shared/constants/labels';
import { CurrencyArsPipe } from '../../shared/pipes/labels.pipe';
import {
  formatQuoteMobileContextHint,
  quoteLinesMetaLabel,
  quoteStatusPillClass,
} from '../../shared/utils/quote.helpers';

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
    () => QUOTE_STATUS_LABELS[this.quote().status] ?? this.quote().status,
  );

  protected readonly statusPillClass = computed(() =>
    quoteStatusPillClass(this.quote().status),
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
