import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CurrencyArsPipe } from '../../shared/pipes/labels.pipe';
import { DbButtonComponent } from '../db-button/db-button.component';

import type { SaleCartLine } from './sale-cart-line.types';
import { KeepTypingDirective } from '../../shared/directives/keep-typing.directive';

export type { SaleCartLine } from './sale-cart-line.types';

@Component({
  selector: 'app-sale-cart-line',
  standalone: true,
  imports: [KeepTypingDirective, FormsModule, RouterLink, CurrencyArsPipe, DbButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sale-cart-line.component.html',
  styleUrl: './sale-cart-line.component.scss',
})
export class SaleCartLineComponent {
  @Input({ required: true }) line!: SaleCartLine;
  @Output() quantityChange = new EventEmitter<number>();
  @Output() remove = new EventEmitter<void>();

  get lineTotal(): number {
    return this.line.quantity * this.line.unitPrice;
  }

  onQuantityChange(value: number): void {
    const quantity = Number(value);
    if (!quantity || quantity <= 0) return;
    this.quantityChange.emit(quantity);
  }
}
