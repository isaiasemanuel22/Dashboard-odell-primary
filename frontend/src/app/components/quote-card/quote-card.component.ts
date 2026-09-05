import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Quote } from '../../core/models';
import {
  CurrencyArsPipe,
  DateShortPipe,
  QuoteStatusLabelPipe,
  ServiceTypeLabelPipe,
} from '../../shared/pipes/labels.pipe';
import { DbServiceBadgesComponent } from '../db-service-badges/db-service-badges.component';
import { DbStatusBadgeComponent } from '../db-status-badge/db-status-badge.component';
import { DbButtonComponent } from '../db-button/db-button.component';
import { isQuoteEditable } from '../../shared/utils/quote.helpers';

@Component({
  selector: 'app-quote-card',
  standalone: true,
  imports: [
    RouterLink,
    CurrencyArsPipe,
    DateShortPipe,
    QuoteStatusLabelPipe,
    ServiceTypeLabelPipe,
    DbServiceBadgesComponent,
    DbStatusBadgeComponent,
    DbButtonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './quote-card.component.html',
  styleUrl: './quote-card.component.scss',
})
export class QuoteCardComponent {
  @Input({ required: true }) quote!: Quote;
  @Output() edit = new EventEmitter<Quote>();
  @Output() delete = new EventEmitter<Quote>();

  readonly previewLimit = 3;

  previewItems(quote: Quote) {
    return quote.items.slice(0, this.previewLimit);
  }

  hiddenItemsCount(quote: Quote): number {
    return Math.max(0, quote.items.length - this.previewLimit);
  }

  canEdit(quote: Quote): boolean {
    return isQuoteEditable(quote.status);
  }
}
