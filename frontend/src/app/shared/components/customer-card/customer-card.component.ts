import { Component, Input } from '@angular/core';
import { Customer } from '../../../core/models';
import { DateShortPipe } from '../../pipes/labels.pipe';

@Component({
  selector: 'app-customer-card',
  standalone: true,
  imports: [DateShortPipe],
  templateUrl: './customer-card.component.html',
  styleUrl: './customer-card.component.scss',
})
export class CustomerCardComponent {
  @Input({ required: true }) customer!: Customer;
}
