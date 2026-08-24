import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SaleCartLine } from '@general-components';
import { Product } from '../models';

let cartLineKey = 0;

export interface AddToCartResult {
  ok: boolean;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class SaleCartService {
  private readonly linesSubject = new BehaviorSubject<SaleCartLine[]>([]);

  readonly lines$ = this.linesSubject.asObservable();

  getLines(): SaleCartLine[] {
    return this.linesSubject.value;
  }

  get itemCount(): number {
    return this.linesSubject.value.reduce((sum, line) => sum + line.quantity, 0);
  }

  addProduct(
    product: Pick<Product, 'id' | 'name' | 'price' | 'published'>,
    quantity = 1,
  ): AddToCartResult {
    if (product.published === false) {
      return { ok: false, error: 'Este producto no está publicado.' };
    }

    const qty = Math.trunc(Number(quantity));
    if (!qty || qty <= 0) {
      return { ok: false, error: 'La cantidad debe ser mayor a cero' };
    }

    const lines = [...this.linesSubject.value];
    const existing = lines.find((line) => line.productId === product.id);

    if (existing) {
      existing.quantity += qty;
    } else {
      lines.push({
        key: `line-${++cartLineKey}`,
        productId: product.id,
        productName: product.name,
        quantity: qty,
        unitPrice: product.price,
      });
    }

    this.linesSubject.next(lines);
    return { ok: true };
  }

  removeLine(key: string): void {
    this.linesSubject.next(
      this.linesSubject.value.filter((line) => line.key !== key),
    );
  }

  updateLineQuantity(key: string, quantity: number): void {
    const qty = Math.trunc(Number(quantity));
    if (!qty || qty <= 0) {
      this.removeLine(key);
      return;
    }

    const lines = this.linesSubject.value.map((line) =>
      line.key === key ? { ...line, quantity: qty } : line,
    );
    this.linesSubject.next(lines);
  }

  clear(): void {
    this.linesSubject.next([]);
  }
}
