import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { BreakpointService } from '../../core/services/breakpoint.service';
import { RealtimeService } from '../../core/services/realtime.service';
import { readRealtimeSyncEnabled } from '../../core/services/realtime-sync.preference';
import { UserAccessService } from '../../core/services/user-access.service';
import { CurrentUserProfile, Supply } from '../../core/models';
import {
  MobileBarComponent,
  MobileToggleRowComponent,
  NavIconComponent,
} from '@general-components';
import { SuppliesFacade } from '../../store/supplies/supplies.facade';

interface MoreTile {
  label: string;
  subtitle: string;
  route: string;
  icon: string;
}

@Component({
  selector: 'app-more',
  standalone: true,
  imports: [
    RouterLink,
    MobileBarComponent,
    MobileToggleRowComponent,
    NavIconComponent,
  ],
  templateUrl: './more.component.html',
  styleUrl: './more.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MoreComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly userAccess = inject(UserAccessService);
  private readonly breakpoint = inject(BreakpointService);
  private readonly router = inject(Router);
  private readonly realtime = inject(RealtimeService);
  private readonly suppliesFacade = inject(SuppliesFacade);

  readonly authEnabled = this.auth.enabled;
  readonly realtimeSyncEnabled = signal(readRealtimeSyncEnabled());

  readonly profile = toSignal(
    this.userAccess.currentUser$.pipe(
      map((value) =>
        value && 'authenticated' in value && value.authenticated === false
          ? null
          : (value as CurrentUserProfile | null),
      ),
    ),
    { initialValue: null },
  );

  private readonly supplies = toSignal(this.suppliesFacade.supplies(), {
    initialValue: [] as Supply[],
  });

  readonly hasDisplayName = computed(() => {
    const name = this.profile()?.displayName?.trim();
    return !!name;
  });

  readonly primaryLine = computed(() => {
    if (this.hasDisplayName()) {
      return this.profile()!.displayName.trim();
    }
    return this.email() || 'Usuario';
  });

  readonly email = computed(() => {
    const profile = this.profile();
    return profile?.email ?? this.auth.currentUser?.email ?? '';
  });

  readonly roleLabel = computed(() => {
    const roles = this.profile()?.roles ?? [];
    if (roles.length === 0) return '';
    return roles.map((role) => role.name).filter(Boolean).join(', ');
  });

  readonly secondaryLine = computed(() => {
    const role = this.roleLabel();
    const email = this.email();
    if (this.hasDisplayName()) {
      if (role && email) return `${role} · ${email}`;
      return role || email;
    }
    // Sin nombre: el email ya está en negrita; no lo repetimos.
    return role;
  });

  readonly initials = computed(() => {
    const name = this.primaryLine().trim();
    if (!name) return '?';
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  });

  private readonly lowStockCount = computed(() =>
    this.supplies().filter((supply) => supply.quantity <= supply.minStock).length,
  );

  /** Mismos destinos que el sidebar; el layout no filtra por rol hoy. */
  readonly tiles = computed<MoreTile[]>(() => {
    const lowStock = this.lowStockCount();
    return [
      {
        label: 'Presupuestos',
        subtitle: 'Cotizaciones y PDF',
        route: '/presupuestos',
        icon: 'quotes',
      },
      {
        label: 'Ventas',
        subtitle: 'Mostrador y reporte',
        route: '/ventas',
        icon: 'sales',
      },
      {
        label: 'Productos',
        subtitle: 'Catálogo y precios',
        route: '/productos',
        icon: 'products',
      },
      {
        label: 'Insumos',
        subtitle: `${lowStock} con stock bajo`,
        route: '/insumos',
        icon: 'supplies',
      },
      {
        label: 'Clientes',
        subtitle: 'Fichas y saldos',
        route: '/clientes',
        icon: 'customers',
      },
      {
        label: 'Cola de trabajo',
        subtitle: 'Qué imprimir ahora',
        route: '/cola',
        icon: 'queue',
      },
      {
        label: 'Calendario',
        subtitle: 'Entregas y eventos',
        route: '/calendario',
        icon: 'calendar',
      },
      {
        label: 'Ajustes',
        subtitle: 'Costos, márgenes, usuarios',
        route: '/ajustes',
        icon: 'm-settings',
      },
    ];
  });

  ngOnInit(): void {
    if (!this.breakpoint.isMobile()) {
      void this.router.navigateByUrl('/dashboard');
    }
  }

  onRealtimeSyncChange(enabled: boolean): void {
    this.realtimeSyncEnabled.set(enabled);
    this.realtime.setSyncEnabled(enabled);
  }

  toggleRealtimeSync(): void {
    this.onRealtimeSyncChange(!this.realtimeSyncEnabled());
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/login');
  }
}
