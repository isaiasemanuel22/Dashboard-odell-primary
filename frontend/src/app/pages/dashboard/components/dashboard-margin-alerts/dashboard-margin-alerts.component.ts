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
import { formatPercentInteger } from '../../../../shared/utils/percent.util';
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

  protected readonly targetPercent = computed(() => {
    const first = this.alerts()[0];
    const raw = first?.targetPercent ?? 40;
    return Number(formatPercentInteger(raw) ?? 40);
  });

  protected readonly totalCount = computed(() => this.alerts().length);

  protected readonly visibleAlerts = computed(() =>
    this.alerts().slice(0, VISIBLE_ALERTS),
  );

  protected readonly maxScale = computed(() =>
    Math.max(this.targetPercent() * 1.5, 60),
  );

  protected productsLabel(count: number): string {
    return count === 1 ? '1 producto' : `${count} productos`;
  }

  protected viewAllLabel(count: number): string {
    return count === 1
      ? 'Ver la 1 alerta →'
      : `Ver las ${count} alertas →`;
  }

  protected barWidth(percent: number): number {
    return Math.min(100, Math.max(0, (percent / this.maxScale()) * 100));
  }

  protected targetMark(): number {
    return Math.min(100, (this.targetPercent() / this.maxScale()) * 100);
  }

  protected raiseLabel(price: number): string {
    return `Subir a ${this.currency.transform(price)}`;
  }

  protected barAriaLabel(markupPercent: number): string {
    const pct = formatPercentInteger(markupPercent) ?? '—';
    return `Margen ${pct}% contra objetivo ${this.targetPercent()}%`;
  }

  protected onRaise(alert: DashboardMarginAlert): void {
    this.raisePrice.emit(alert);
  }
}
