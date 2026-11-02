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
import { DbButtonComponent } from '../components/db-button/db-button.component';
import { NavIconComponent } from '../components/nav-icon/nav-icon.component';
import { FormDialogService } from '../shared/form-dialogs/form-dialog.service';
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
  /** En `/ventas` el FAB abre venta de mostrador; en `/presupuestos`, nuevo presupuesto; en `/clientes`, nuevo cliente. */
  fabOpensCounterSale = false;
  fabOpensQuote = false;
  fabOpensCustomer = false;

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
    this.applyRouteUi(this.router.url);

    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        map(() => this.router.url),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((url) => {
        const urlChanged = url !== this.lastNavUrl;
        this.lastNavUrl = url;
        this.applyRouteUi(url);
        if (!urlChanged) return;
        this.closeNav();
      });

    this.scheduleDialogPrefetch();
  }

  /** Precarga diálogos frecuentes cuando el browser está idle. */
  private scheduleDialogPrefetch(): void {
    const run = () => this.formDialogs.prefetchCommon();
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void) => number;
    };
    if (typeof w.requestIdleCallback === 'function') {
      w.requestIdleCallback(run);
    } else {
      setTimeout(run, 2000);
    }
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

  private applyRouteUi(url: string): void {
    const path = url.split(/[?#]/)[0];
    this.hideBottomNav = this.shouldHideBottomNav(path);
    this.fabOpensCounterSale = path === '/ventas';
    this.fabOpensQuote = path === '/presupuestos';
    this.fabOpensCustomer = path === '/clientes';
  }

  private shouldHideBottomNav(path: string): boolean {
    return (
      path.includes('/ventas/nueva') ||
      /\/ventas\/[^/]+\/editar/.test(path) ||
      /^\/pedidos\/[^/]+$/.test(path) ||
      /^\/presupuestos\/[^/]+$/.test(path) ||
      /^\/clientes\/[^/]+$/.test(path) ||
      /^\/productos\/[^/]+$/.test(path) ||
      path === '/ajustes/valores-generales' ||
      path === '/ajustes/ganancias' ||
      path === '/ajustes/impresos'
    );
  }

  onFabClick(): void {
    if (this.fabOpensCounterSale) {
      void this.router.navigateByUrl('/ventas/nueva');
      return;
    }
    if (this.fabOpensQuote) {
      this.openNewQuote();
      return;
    }
    if (this.fabOpensCustomer) {
      this.openNewCustomer();
      return;
    }
    this.openNewOrder();
  }

  openNewOrder(): void {
    this.formDialogs.openOrder().subscribe((saved) => {
      if (!saved) return;
      void this.router.navigateByUrl('/pedidos');
    });
  }

  openNewQuote(): void {
    this.formDialogs.openQuote().subscribe((saved) => {
      if (!saved) return;
      void this.router.navigateByUrl('/presupuestos');
    });
  }

  openNewCustomer(): void {
    this.formDialogs.openCustomer().subscribe((saved) => {
      if (!saved) return;
      void this.router.navigateByUrl(`/clientes/${saved.id}`);
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
