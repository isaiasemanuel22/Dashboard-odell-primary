import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  DbAutocompleteComponent,
  DbAutocompleteOption,
  DbButtonComponent,
  DbFormGridComponent,
  DbInputComponent,
  DbSegmentedControlComponent,
  DbSelectComponent,
  DbSegmentOption,
  DbSelectOption,
} from '@general-components';
import { PriceType } from '../../../../core/models';

export type WholesaleMinimumNotice = {
  kind: 'ok' | 'warn';
  message: string;
} | null;

@Component({
  selector: 'app-order-form-party',
  standalone: true,
  imports: [
    FormsModule,
    DbFormGridComponent,
    DbSelectComponent,
    DbAutocompleteComponent,
    DbInputComponent,
    DbButtonComponent,
    DbSegmentedControlComponent,
  ],
  templateUrl: './order-form-party.component.html',
  styleUrl: './order-form-party.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
})
export class OrderFormPartyComponent {
  @Input() variant: 'order' | 'quote' = 'order';
  @Input() customerId = '';
  @Input() customerOptions: DbAutocompleteOption[] = [];
  @Input() dueDate = '';
  @Input() minDueDate = '';
  @Input() dueDateError = '';
  @Input() dueDateHint = '';
  @Input() quotedAtLabel = '';
  @Input() quoteValidityLabel = '';

  /** Pill «Revendedor · −X%» junto al cliente. */
  @Input() resellerPillLabel = '';
  @Input() salesChannel: string | null = null;
  @Input() salesChannelOptions: DbSelectOption[] = [];
  @Input() responsibleUserId = '';
  @Input() responsibleOptions: DbSelectOption[] = [];
  @Input() responsibleError = '';
  @Input() priceType: PriceType = PriceType.LISTA;
  @Input() priceTypeOptions: DbSegmentOption<PriceType>[] = [];
  @Input() wholesaleMinimumNotice: WholesaleMinimumNotice = null;

  @Output() customerIdChange = new EventEmitter<string>();
  @Output() dueDateChange = new EventEmitter<string>();
  @Output() newCustomer = new EventEmitter<void>();
  @Output() salesChannelChange = new EventEmitter<string | null>();
  @Output() responsibleUserIdChange = new EventEmitter<string>();
  @Output() priceTypeChange = new EventEmitter<PriceType>();

  readonly PriceType = PriceType;
}
