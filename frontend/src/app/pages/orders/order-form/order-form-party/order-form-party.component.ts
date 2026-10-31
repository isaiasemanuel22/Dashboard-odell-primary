import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  DbButtonComponent,
  DbFormGridComponent,
  DbInputComponent,
  DbSelectComponent,
} from '@general-components';
import { DbSelectOption } from '../../../../components/dashboard-form/db-select/db-select.types';

@Component({
  selector: 'app-order-form-party',
  standalone: true,
  imports: [
    FormsModule,
    DbFormGridComponent,
    DbSelectComponent,
    DbInputComponent,
    DbButtonComponent,
  ],
  templateUrl: './order-form-party.component.html',
  styleUrl: './order-form-party.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
})
export class OrderFormPartyComponent {
  @Input() variant: 'order' | 'quote' = 'order';
  @Input() customerId = '';
  @Input() customerOptions: DbSelectOption[] = [];
  @Input() dueDate = '';
  @Input() minDueDate = '';
  @Input() dueDateError = '';
  @Input() dueDateHint = '';
  @Input() quotedAtLabel = '';
  @Input() quoteValidityLabel = '';

  @Output() customerIdChange = new EventEmitter<string>();
  @Output() dueDateChange = new EventEmitter<string>();
  @Output() newCustomer = new EventEmitter<void>();
}
