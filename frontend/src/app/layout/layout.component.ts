import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../core/auth/auth.service';
import { UserAccessService } from '../core/services/user-access.service';
import { RealtimeService } from '../core/services/realtime.service';
import { StoreBootstrapService } from '../store/store-bootstrap.service';
import { SuppliesFacade } from '../store/supplies/supplies.facade';
import { DbButtonComponent } from '@general-components';

interface NavItem {
  label: string;
  route: string;
  icon: string;
  exact?: boolean;
}

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [AsyncPipe, RouterOutlet, RouterLink, RouterLinkActive, DbButtonComponent],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss',
})
export class LayoutComponent implements OnInit {
  private readonly realtime = inject(RealtimeService);
  private readonly storeBootstrap = inject(StoreBootstrapService);
  private readonly suppliesFacade = inject(SuppliesFacade);
  private readonly auth = inject(AuthService);
  private readonly userAccess = inject(UserAccessService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly user$ = this.auth.currentUser$;
  readonly authEnabled = this.auth.enabled;

  navOpen = false;
  hideBottomNav = false;

  readonly navItems: NavItem[] = [
    { label: 'Dashboard', route: '/dashboard', icon: '📊', exact: true },
    { label: 'Billetera', route: '/billetera', icon: '💼' },
    { label: 'Ventas', route: '/ventas', icon: '💰' },
    { label: 'Pedidos', route: '/pedidos', icon: '📦' },
    { label: 'Presupuestos', route: '/presupuestos', icon: '📝' },
    { label: 'Cola de trabajo', route: '/cola', icon: '🖨️' },
    { label: 'Productos', route: '/productos', icon: '🏷️' },
    { label: 'Insumos', route: '/insumos', icon: '🧵' },
    { label: 'Clientes', route: '/clientes', icon: '👥' },
    { label: 'Ajustes', route: '/ajustes', icon: '⚙️' },
  ];

  readonly bottomNavItems: NavItem[] = [
    { label: 'Inicio', route: '/dashboard', icon: '📊', exact: true },
    { label: 'Productos', route: '/productos', icon: '🏷️' },
    { label: 'Presupuesto', route: '/presupuestos', icon: '📝' },
    { label: 'Ventas', route: '/ventas', icon: '💰' },
  ];

  ngOnInit(): void {
    this.realtime.connectIfEnabled();
    this.storeBootstrap.bootstrap();
    this.userAccess.loadCurrentUser().subscribe({
      error: () => undefined,
    });
    this.realtime.bindReload(this.destroyRef, 'supplies', () =>
      this.suppliesFacade.refresh(),
    );
    this.destroyRef.onDestroy(() => this.realtime.disconnect());

    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        map(() => this.router.url),
        startWith(this.router.url),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((url) => {
        this.closeNav();
        this.hideBottomNav =
          url.includes('/ventas/nueva') || /\/ventas\/[^/]+\/editar/.test(url);
      });
  }

  openNav(): void {
    this.navOpen = true;
  }

  closeNav(): void {
    this.navOpen = false;
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/login');
  }
}
