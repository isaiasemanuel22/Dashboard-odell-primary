import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import {
  DbCheckboxComponent,
  MobileSettingsPageComponent,
  MobileToggleRowComponent,
} from '@general-components';
import {
  AutomaticAlertsSettings,
  CurrentUserProfile,
} from '../../../core/models';
import { BreakpointService } from '../../../core/services/breakpoint.service';
import { SettingsService } from '../../../core/services/settings.service';
import { UserAccessService } from '../../../core/services/user-access.service';
import { extractApiErrorMessage } from '../../../shared/utils/api-error';

interface AlertOption {
  key: keyof AutomaticAlertsSettings;
  label: string;
  hint: string;
}

@Component({
  selector: 'app-alerts-settings',
  standalone: true,
  imports: [
    DbCheckboxComponent,
    MobileSettingsPageComponent,
    MobileToggleRowComponent,
  ],
  templateUrl: './alerts-settings.component.html',
  styleUrl: './alerts-settings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlertsSettingsComponent implements OnInit, OnDestroy {
  private readonly settingsService = inject(SettingsService);
  private readonly breakpoint = inject(BreakpointService);
  private readonly userAccess = inject(UserAccessService);
  private readonly cdr = inject(ChangeDetectorRef);
  private messageTimer: ReturnType<typeof setTimeout> | null = null;

  readonly isMobile = this.breakpoint.isMobile;

  private readonly profile = toSignal(
    this.userAccess.currentUser$.pipe(
      map((value) =>
        value && 'authenticated' in value && value.authenticated === false
          ? null
          : (value as CurrentUserProfile | null),
      ),
    ),
    { initialValue: null },
  );

  readonly isAdmin = computed(() => !!this.profile()?.isAdmin);

  readonly options: AlertOption[] = [
    {
      key: 'ordersDue',
      label: 'Pedidos atrasados o que vencen mañana',
      hint: 'Todos los días · 9:00 · A vos · WhatsApp',
    },
    {
      key: 'lowStock',
      label: 'Stock bajo y “pedir antes del”',
      hint: 'De 8 a 21 h · A vos · WhatsApp',
    },
    {
      key: 'weeklyReceivables',
      label: 'Resumen de saldos por cobrar',
      hint: 'Lunes · 9:00 · A vos · email',
    },
  ];

  alerts: AutomaticAlertsSettings | null = null;
  message = '';

  ngOnInit(): void {
    this.settingsService.getGeneralSettings().subscribe((settings) => {
      this.alerts = settings.automaticAlerts;
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.clearMessageTimer();
  }

  toggle(key: keyof AutomaticAlertsSettings, value: boolean): void {
    if (!this.alerts || !this.isAdmin()) return;
    const previous = this.alerts;
    this.alerts = { ...previous, [key]: value };
    this.settingsService.updateAutomaticAlerts({ [key]: value }).subscribe({
      next: (saved) => {
        this.alerts = saved;
        this.flashMessage('Avisos guardados');
      },
      error: (err) => {
        this.alerts = previous;
        this.flashMessage(
          extractApiErrorMessage(err, 'No se pudieron guardar los avisos'),
        );
      },
    });
  }

  private flashMessage(text: string): void {
    this.message = text;
    this.clearMessageTimer();
    this.messageTimer = setTimeout(() => {
      this.message = '';
      this.messageTimer = null;
      this.cdr.markForCheck();
    }, 3000);
    this.cdr.markForCheck();
  }

  private clearMessageTimer(): void {
    if (this.messageTimer) {
      clearTimeout(this.messageTimer);
      this.messageTimer = null;
    }
  }
}
