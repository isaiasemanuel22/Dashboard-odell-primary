import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Product } from '../../core/models';
import { ProductMobileCardComponent } from './product-mobile-card.component';

describe('ProductMobileCardComponent', () => {
  function render(partial: Partial<Product>): HTMLElement {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture: ComponentFixture<ProductMobileCardComponent> =
      TestBed.createComponent(ProductMobileCardComponent);
    fixture.componentRef.setInput('product', {
      id: 'p1',
      name: 'Taza',
      type: 'FDM',
      images: [],
      categoryIds: [],
      price: 9000,
      cost: 5670,
      ...partial,
    } as unknown as Product);
    fixture.componentRef.setInput('categories', []);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('muestra el margen total sobre el costo total', () => {
    const el = render({});
    expect(el.querySelector('.pmc__margin .pmc__price-label')?.textContent).toContain('M. total');
    const pct = el.querySelector('.pmc__margin-pct');
    expect(pct?.textContent?.replace(/\s/g, '')).toBe('59%');
    expect(pct?.classList).toContain('pmc__margin-pct--ok');
  });

  it('marca en rojo el margen total negativo', () => {
    const el = render({ price: 4000 });
    const pct = el.querySelector('.pmc__margin-pct');
    expect(pct?.classList).toContain('pmc__margin-pct--low');
  });
});
