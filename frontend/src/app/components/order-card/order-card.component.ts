import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Order } from '../../core/models';
import {
  CurrencyArsPipe,
  DateShortPipe,
  OrderStatusLabelPipe,
  PlainTextPipe,
} from '../../shared/pipes/labels.pipe';
import { DbButtonComponent } from '../db-button/db-button.component';
import { DbServiceBadgeComponent } from '../db-service-badge/db-service-badge.component';

@Component({
  selector: 'app-order-card',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    RouterLink,
    CurrencyArsPipe,
    DateShortPipe,
    OrderStatusLabelPipe,
    PlainTextPipe,
    DbButtonComponent,
    DbServiceBadgeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './order-card.component.html',
  styleUrl: './order-card.component.scss',
})
export class OrderCardComponent {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) order!: Order;
  /** card: ficha suelta. table: fila. detail: solo el panel expandido. */
  @Input() layout: 'table' | 'card' | 'detail' = 'table';
  @Output() edit = new EventEmitter<Order>();
  @Output() delete = new EventEmitter<Order>();

  expanded = false;
  menuOpen = false;

  get summaryLabel(): string {
    const products = this.order.items.length;
    const units = this.order.items.reduce(
      (sum, item) => sum + (Number(item.quantity) || 0),
      0,
    );
    const productWord = products === 1 ? 'producto' : 'productos';
    const unitWord = units === 1 ? 'unidad' : 'unidades';
    return `${products} ${productWord} · ${units} ${unitWord}`;
  }

  finishedCount(item: Order['items'][number]): number {
    const produced = item.producedQuantity ?? item.produced ?? 0;
    return Math.min(item.quantity, Math.max(0, produced));
  }

  progressPercent(item: Order['items'][number]): number {
    if (!item.quantity) return 0;
    return Math.round((this.finishedCount(item) / item.quantity) * 100);
  }

  get isOverdue(): boolean {
    if (
      this.order.status === 'entregado' ||
      this.order.status === 'cancelado'
    ) {
      return false;
    }
    const due = new Date(this.order.dueDate);
    if (Number.isNaN(due.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    return due < today;
  }

  toggleMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.menuOpen = !this.menuOpen;
  }

  confirmDelete(): void {
    this.menuOpen = false;
    this.delete.emit(this.order);
  }

  @HostListener('document:click', ['$event'])
  closeMenuFromOutside(event: MouseEvent): void {
    if (!this.menuOpen) return;
    if (this.host.nativeElement.contains(event.target as Node)) return;
    this.menuOpen = false;
    this.cdr.markForCheck();
  }
}
