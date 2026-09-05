import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject, catchError, of, startWith, switchMap } from 'rxjs';
import { DashboardService } from '../../core/services/dashboard.service';
import { RealtimeService } from '../../core/services/realtime.service';
import {
  CurrencyArsPipe,
  ServiceTypeLabelPipe,
} from '../../shared/pipes/labels.pipe';
import { FormDialogService } from '../../shared/form-dialogs/public-api';
import {
  DbStateMessageComponent,
  DashboardMonthlyTrendsComponent,
  DashboardNotificationsComponent,
  OrdersTableComponent,
} from '@general-components';

type QuickActionId = 'order' | 'quote' | 'product' | 'customer';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    AsyncPipe,
    RouterLink,
    CurrencyArsPipe,
    ServiceTypeLabelPipe,
    DbStateMessageComponent,
    DashboardMonthlyTrendsComponent,
    DashboardNotificationsComponent,
    OrdersTableComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  private readonly dashboard = inject(DashboardService);
  private readonly realtime = inject(RealtimeService);
  private readonly formDialogs = inject(FormDialogService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly refresh$ = new Subject<void>();

  loadError = false;

  readonly quickActions: {
    id: QuickActionId;
    label: string;
    icon: string;
  }[] = [
    { id: 'order', label: 'Nuevo pedido', icon: '📦' },
    { id: 'quote', label: 'Nuevo presupuesto', icon: '📝' },
    { id: 'product', label: 'Nuevo producto', icon: '🏷️' },
    { id: 'customer', label: 'Nuevo cliente', icon: '👤' },
  ];

  stats$ = this.refresh$.pipe(
    startWith(void 0),
    switchMap(() =>
      this.dashboard.getStats().pipe(
        catchError(() => {
          this.loadError = true;
          this.cdr.markForCheck();
          return of(null);
        }),
      ),
    ),
  );

  ngOnInit(): void {
    this.realtime.bindReload(
      this.destroyRef,
      ['dashboard', 'orders', 'sales', 'print-jobs', 'customers', 'products'],
      () => this.refresh$.next(),
    );
  }

  openForm(action: QuickActionId): void {
    switch (action) {
      case 'order':
        this.formDialogs.openOrder().subscribe((saved) => {
          if (saved) this.refresh$.next();
        });
        break;
      case 'quote':
        this.formDialogs.openQuote().subscribe((saved) => {
          if (saved) this.refresh$.next();
        });
        break;
      case 'product':
        this.formDialogs.openProduct().subscribe((saved) => {
          if (saved) this.refresh$.next();
        });
        break;
      case 'customer':
        this.formDialogs.openCustomer().subscribe((saved) => {
          if (saved) this.refresh$.next();
        });
        break;
    }
  }
}
