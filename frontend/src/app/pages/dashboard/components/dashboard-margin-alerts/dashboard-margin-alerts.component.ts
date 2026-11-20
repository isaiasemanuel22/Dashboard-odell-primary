import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { DashboardMarginAlert } from '../../../../core/models';
import {
  CurrencyArsPipe,
  PercentIntegerPipe,
} from '../../../../shared/pipes/labels.pipe';
import { DbButtonComponent } from '@general-components';

const VISIBLE_ALERTS = 3;

@Component({
  selector: 'app-dashboard-margin-alerts',
  standalone: true,
  imports: [
    RouterLink,
    CurrencyArsPipe,
    PercentIntegerPipe,
    DbButtonComponent,
  ],
  templateUrl: './dashboard-margin-alerts.component.html',
  styleUrl: './dashboard-margin-alerts.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [CurrencyArsPipe],
})
export class DashboardMarginAlertsComponent {
  private readonly currency = inject(CurrencyArsPipe);

  readonly alerts = input.required<DashboardMarginAlert[]>();
  readonly raisePrice = output<DashboardMarginAlert>();

  protected readonly totalCount = computed(() => this.alerts().length);

  protected readonly visibleAlerts = computed(() =>
    this.alerts().slice(0, VISIBLE_ALERTS),
  );

  protected productsLabel(count: number): string {
    return count === 1 ? '1 producto' : `${count} productos`;
  }

  protected viewAllLabel(count: number): string {
    return count === 1
      ? 'Ver la 1 alerta →'
      : `Ver las ${count} alertas →`;
  }

  /** Precio de venta como % del calculado (el relleno de la barra). */
  protected barWidth(alert: DashboardMarginAlert): number {
    if (!(alert.priceForTarget > 0)) return 0;
    return Math.min(
      100,
      Math.max(0, (alert.salePrice / alert.priceForTarget) * 100),
    );
  }

  /** Cuánto le falta al precio de venta para llegar al calculado. */
  protected belowCalculated(alert: DashboardMarginAlert): number {
    return Math.max(0, alert.priceForTarget - alert.salePrice);
  }

  protected raiseLabel(price: number): string {
    return `Subir a ${this.currency.transform(price)}`;
  }

  protected barAriaLabel(alert: DashboardMarginAlert): string {
    return `Precio de venta ${this.currency.transform(alert.salePrice)} contra calculado ${this.currency.transform(alert.priceForTarget)}`;
  }

  protected onRaise(alert: DashboardMarginAlert): void {
    this.raisePrice.emit(alert);
  }
}
