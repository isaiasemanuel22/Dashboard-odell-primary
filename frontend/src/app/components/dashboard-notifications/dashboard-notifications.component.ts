import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  Input,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { DashboardNotification } from '../../core/models';

@Component({
  selector: 'app-dashboard-notifications',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './dashboard-notifications.component.html',
  styleUrl: './dashboard-notifications.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardNotificationsComponent {
  private readonly host = inject(ElementRef<HTMLElement>);

  @Input({ required: true }) notifications: DashboardNotification[] = [];

  open = false;

  get count(): number {
    return this.notifications.length;
  }

  togglePanel(): void {
    this.open = !this.open;
  }

  closePanel(): void {
    this.open = false;
  }

  trackNotification(_index: number, item: DashboardNotification): string {
    return item.id;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.open) return;
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.open = false;
    }
  }
}
