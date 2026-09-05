import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { SaleCartLine } from '../sale-cart-line/sale-cart-line.types';
import { DbButtonComponent } from '../db-button/db-button.component';
import { CurrencyArsPipe } from '../../shared/pipes/labels.pipe';

@Component({
  selector: 'app-sale-cart-line-card',
  standalone: true,
  imports: [FormsModule, RouterLink, DbButtonComponent, CurrencyArsPipe],
  templateUrl: './sale-cart-line-card.component.html',
  styleUrl: './sale-cart-line-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SaleCartLineCardComponent {
  @Input({ required: true }) line!: SaleCartLine;
  @Output() quantityChange = new EventEmitter<number>();
  @Output() remove = new EventEmitter<void>();

  get lineTotal(): number {
    return this.line.quantity * this.line.unitPrice;
  }

  onQuantityChange(value: number | string): void {
    const quantity = Number(value);
    if (!quantity || quantity <= 0) return;
    this.quantityChange.emit(quantity);
  }
}
