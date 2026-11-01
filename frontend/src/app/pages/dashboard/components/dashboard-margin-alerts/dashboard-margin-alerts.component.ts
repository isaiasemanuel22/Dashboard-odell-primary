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
import { CurrencyArsPipe } from '../../../../shared/pipes/labels.pipe';
import { DbButtonComponent } from '@general-components';

@Component({
  selector: 'app-dashboard-margin-alerts',
  standalone: true,
  imports: [RouterLink, CurrencyArsPipe, DbButtonComponent],
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
    return first?.targetPercent ?? 40;
  });

  protected readonly maxScale = computed(() =>
    Math.max(this.targetPercent() * 1.5, 60),
  );

  protected productsLabel(count: number): string {
    return count === 1 ? '1 producto' : `${count} productos`;
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

  protected onRaise(alert: DashboardMarginAlert): void {
    this.raisePrice.emit(alert);
  }
}
