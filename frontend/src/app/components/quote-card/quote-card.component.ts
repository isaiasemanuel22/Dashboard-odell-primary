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
} from '../../shared/pipes/labels.pipe';
import { DbButtonComponent } from '../db-button/db-button.component';
import { DbServiceBadgeComponent } from '../db-service-badge/db-service-badge.component';
import { isQuoteEditable } from '../../shared/utils/quote.helpers';

@Component({
  selector: 'app-quote-card',
  standalone: true,
  imports: [
    RouterLink,
    CurrencyArsPipe,
    DateShortPipe,
    QuoteStatusLabelPipe,
    DbButtonComponent,
    DbServiceBadgeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './quote-card.component.html',
  styleUrl: './quote-card.component.scss',
})
export class QuoteCardComponent {
  @Input({ required: true }) quote!: Quote;
  /** detail: solo el panel expandido, para usarlo dentro de db-data-table. */
  @Input() layout: 'row' | 'detail' = 'row';
  @Output() edit = new EventEmitter<Quote>();
  @Output() delete = new EventEmitter<Quote>();

  expanded = false;
  menuOpen = false;

  get summaryLabel(): string {
    const concepts = this.quote.items.length;
    const units = this.quote.items.reduce(
      (sum, item) => sum + (Number(item.quantity) || 0),
      0,
    );
    const conceptWord = concepts === 1 ? 'concepto' : 'conceptos';
    const unitWord = units === 1 ? 'unidad' : 'unidades';
    return `${concepts} ${conceptWord} · ${units} ${unitWord}`;
  }

  get canEdit(): boolean {
    return isQuoteEditable(this.quote.status);
  }

  confirmDelete(): void {
    this.menuOpen = false;
    this.delete.emit(this.quote);
  }
}
