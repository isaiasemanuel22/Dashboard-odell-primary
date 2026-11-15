import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { lossReasonNotice } from '../../shared/utils/loss-reason';

/** Aviso chico «Vendido a pérdida · motivo[ · nota]» (desktop y mobile). */
@Component({
  selector: 'app-loss-sale-notice',
  standalone: true,
  template: `
    @if (text()) {
      <p class="loss-sale-notice" role="note">{{ text() }}</p>
    }
  `,
  styleUrl: './loss-sale-notice.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LossSaleNoticeComponent {
  readonly reason = input<string | null | undefined>(null);
  readonly note = input<string | null | undefined>(null);
  readonly text = computed(() => lossReasonNotice(this.reason(), this.note()));
}
