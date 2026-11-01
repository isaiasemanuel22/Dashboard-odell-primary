import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Params, RouterLink } from '@angular/router';

export interface DashboardAttentionItem {
  id: string;
  tone: 'danger' | 'warn';
  title: string;
  detail: string;
  actionLabel: string;
  route: string;
  fragment?: string;
  queryParams?: Params;
}

@Component({
  selector: 'app-dashboard-attention',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './dashboard-attention.component.html',
  styleUrl: './dashboard-attention.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardAttentionComponent {
  readonly items = input.required<DashboardAttentionItem[]>();

  protected thingsLabel(count: number): string {
    return count === 1 ? '1 cosa' : `${count} cosas`;
  }
}
