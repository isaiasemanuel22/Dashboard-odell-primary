import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Product } from '../../core/models';
import { ProductCardComponent } from './product-card.component';

describe('ProductCardComponent', () => {
  function render(partial: Partial<Product>) {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(ProductCardComponent);
    fixture.componentInstance.product = {
      id: 'p1',
      name: 'Taza',
      type: 'FDM',
      images: [],
      categoryIds: [],
      price: 9000,
      cost: 5670,
      updatedAt: new Date().toISOString(),
      ...partial,
    } as unknown as Product;
    fixture.componentInstance.categories = [];
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('muestra el margen total sobre el costo total', () => {
    const el = render({});
    expect(el.querySelector('.product-card__margin-label')?.textContent).toContain('Margen total');
    const value = el.querySelector('.product-card__margin-value');
    expect(value?.textContent?.trim()).toBe('59%');
    expect(value?.classList).toContain('product-card__margin-value--ok');
  });

  it('marca en rojo el margen total negativo', () => {
    const el = render({ price: 4000 });
    const value = el.querySelector('.product-card__margin-value');
    expect(value?.textContent?.trim()).toBe('-29%');
    expect(value?.classList).toContain('product-card__margin-value--low');
  });

  it('deja neutro el margen total en 0', () => {
    const el = render({ price: 5670 });
    const value = el.querySelector('.product-card__margin-value');
    expect(value?.classList).not.toContain('product-card__margin-value--ok');
    expect(value?.classList).not.toContain('product-card__margin-value--low');
  });
});
