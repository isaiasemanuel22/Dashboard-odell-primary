import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideStore } from '@ngrx/store';
import { OrderItem } from '../../../core/models';
import { OrderDetailComponent } from './order-detail.component';

describe('OrderDetailComponent: columna Margen total', () => {
  let component: OrderDetailComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideStore({}),
      ],
    });
    component = TestBed.createComponent(OrderDetailComponent).componentInstance;
  });

  const item = (unitPrice: number, unitCost: number): OrderItem =>
    ({ serviceType: 'fdm', unitPrice, unitCost }) as unknown as OrderItem;

  it('la tabla de escritorio tiene Margen total alineada a la derecha, antes de Subtotal', () => {
    const keys = component.lineColumns.map((c) => c.key);
    const margin = component.lineColumns.find((c) => c.key === 'margin');
    expect(margin?.header).toBe('Margen total');
    expect(margin?.align).toBe('end');
    expect(keys.indexOf('margin')).toBe(keys.indexOf('subtotal') - 1);
  });

  it('usa el mismo valor que el pill mobile: (precio - costo) / costo', () => {
    expect(component.lineMarginPercent(item(150, 100))).toBe(50);
    expect(component.lineMarginOk(item(150, 100))).toBeTrue();
  });

  it('una línea con pérdida queda en amarillo (no ok)', () => {
    expect(component.lineMarginPercent(item(80, 100))).toBe(-20);
    expect(component.lineMarginOk(item(80, 100))).toBeFalse();
  });

  it('sin costo no hay margen (la celda muestra —)', () => {
    expect(component.lineMarginPercent(item(150, 0))).toBeNull();
  });
});
