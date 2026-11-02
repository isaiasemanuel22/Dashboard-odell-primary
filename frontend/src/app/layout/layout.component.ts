import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../core/auth/auth.service';
import { UserAccessService } from '../core/services/user-access.service';
import { RealtimeService } from '../core/services/realtime.service';
import { StoreBootstrapService } from '../store/store-bootstrap.service';
import { SuppliesFacade } from '../store/supplies/supplies.facade';
import { DbButtonComponent, NavIconComponent } from '@general-components';
import { FormDialogService } from '../shared/form-dialogs/public-api';
import { LayoutUiService } from './layout-ui.service';

interface NavItem {
  label: string;
  route: string;
  icon: string;
  exact?: boolean;
}

type BottomNavSlot =
  | (NavItem & { kind: 'link' })
  | { kind: 'fab'; label: string; icon: string };

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    AsyncPipe,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    DbButtonComponent,
    NavIconComponent,
  ],
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
  private readonly formDialogs = inject(FormDialogService);
  readonly layoutUi = inject(LayoutUiService);

  readonly user$ = this.auth.currentUser$;
  readonly authEnabled = this.auth.enabled;

  hideBottomNav = false;

  readonly navItems: NavItem[] = [
    { label: 'Dashboard', route: '/dashboard', icon: 'dashboard', exact: true },
    { label: 'Billetera', route: '/billetera', icon: 'wallet' },
    { label: 'Ventas', route: '/ventas', icon: 'sales' },
    { label: 'Pedidos', route: '/pedidos', icon: 'orders' },
    { label: 'Presupuestos', route: '/presupuestos', icon: 'quotes' },
    { label: 'Cola de trabajo', route: '/cola', icon: 'queue' },
    { label: 'Calendario', route: '/calendario', icon: 'calendar' },
    { label: 'Productos', route: '/productos', icon: 'products' },
    { label: 'Insumos', route: '/insumos', icon: 'supplies' },
    { label: 'Clientes', route: '/clientes', icon: 'customers' },
    { label: 'Ajustes', route: '/ajustes', icon: 'settings' },
  ];

  readonly bottomNavItems: BottomNavSlot[] = [
    { kind: 'link', label: 'Inicio', route: '/dashboard', icon: 'm-home', exact: true },
    { kind: 'link', label: 'Pedidos', route: '/pedidos', icon: 'm-orders' },
    { kind: 'fab', label: 'Nuevo pedido', icon: 'plus' },
    { kind: 'link', label: 'Billetera', route: '/billetera', icon: 'm-wallet' },
    { kind: 'link', label: 'Más', route: '/mas', icon: 'more' },
  ];

  /** Solo se cierra el drawer cuando la navegación cambió la URL. */
  private lastNavUrl = '';

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

    this.lastNavUrl = this.router.url;
    this.hideBottomNav = this.shouldHideBottomNav(this.router.url);

    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        map(() => this.router.url),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((url) => {
        const urlChanged = url !== this.lastNavUrl;
        this.lastNavUrl = url;
        this.hideBottomNav = this.shouldHideBottomNav(url);
        if (!urlChanged) return;
        this.closeNav();
      });
  }

  openNav(): void {
    this.layoutUi.openNav();
  }

  closeNav(): void {
    this.layoutUi.closeNav();
  }

  /** Secciones que se abren desde «Más»: todo lo que no tiene pestaña propia. */
  get inMoreSection(): boolean {
    const path = this.router.url.split(/[?#]/)[0];
    return !['/dashboard', '/pedidos', '/billetera', '/mas'].some(
      (route) => path === route || path.startsWith(`${route}/`),
    );
  }

  private shouldHideBottomNav(url: string): boolean {
    return url.includes('/ventas/nueva') || /\/ventas\/[^/]+\/editar/.test(url);
  }

  openNewOrder(): void {
    this.formDialogs.openOrder().subscribe((saved) => {
      if (!saved) return;
      void this.router.navigateByUrl('/pedidos');
    });
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/login');
  }

  trackBottomSlot(_index: number, item: BottomNavSlot): string {
    return item.kind === 'fab' ? 'fab' : item.route;
  }
}
