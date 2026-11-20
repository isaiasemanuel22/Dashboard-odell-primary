import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DashboardMarginAlert } from '../../../../core/models';
import { DashboardMarginAlertsComponent } from './dashboard-margin-alerts.component';

function alert(over: Partial<DashboardMarginAlert>): DashboardMarginAlert {
  return {
    productId: 'p1',
    name: 'Remera DTF',
    price: 3778,
    cost: 10859,
    totalMarginPercent: -65.2,
    priceForTarget: 12000,
    salePrice: 3778,
    fixedPrice: true,
    ...over,
  };
}

describe('DashboardMarginAlertsComponent', () => {
  const text = (el: Element | null) =>
    (el?.textContent ?? '').replace(/\s+/g, ' ');

  function render(alerts: DashboardMarginAlert[]): HTMLElement {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(DashboardMarginAlertsComponent);
    fixture.componentRef.setInput('alerts', alerts);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('muestra el margen total y cuánto falta para el calculado', () => {
    const el = render([alert({})]);
    expect(text(el.querySelector('.margin-alerts__pct'))).toContain('-65%');
    expect(text(el.querySelector('.margin-alerts__gap-amount'))).toContain(
      '$ 8.222 debajo del calculado',
    );
    expect(text(el.querySelector('.margin-alerts__gap'))).toContain(
      'Calculado $ 12.000',
    );
  });

  it('margen total positivo va en verde aunque esté debajo del calculado', () => {
    const el = render([
      alert({ totalMarginPercent: 12, salePrice: 11000, priceForTarget: 12000 }),
    ]);
    expect(el.querySelector('.margin-alerts__pct--positive')).not.toBeNull();
  });
});
