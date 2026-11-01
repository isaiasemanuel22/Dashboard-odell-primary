import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Customer, CustomerType } from '../../core/models';
import { DateShortPipe } from '../../shared/pipes/labels.pipe';
import { customerTypeLabel } from '../../shared/utils/v1-labels.util';
import { DbButtonComponent } from '../db-button/db-button.component';

@Component({
  selector: 'app-customer-card',
  standalone: true,
  imports: [RouterLink, DateShortPipe, DbButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './customer-card.component.html',
  styleUrl: './customer-card.component.scss',
})
export class CustomerCardComponent {
  @Input({ required: true }) customer!: Customer;
  @Output() edit = new EventEmitter<Customer>();
  @Output() delete = new EventEmitter<Customer>();

  get typeLabel(): string {
    return customerTypeLabel(this.customer.type);
  }

  get isRevendedor(): boolean {
    return this.customer.type === CustomerType.REVENDEDOR;
  }
}
