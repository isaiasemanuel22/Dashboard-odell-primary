import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../core/auth/auth.service';
import { RealtimeService } from '../core/services/realtime.service';
import { StoreBootstrapService } from '../store/store-bootstrap.service';
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
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly user$ = this.auth.currentUser$;
  readonly authEnabled = this.auth.enabled;

  navOpen = false;
  hideBottomNav = false;

  readonly navItems: NavItem[] = [
    { label: 'Dashboard', route: '/dashboard', icon: '📊', exact: true },
    { label: 'Ventas', route: '/ventas', icon: '💰' },
    { label: 'Pedidos', route: '/pedidos', icon: '📦' },
    { label: 'Cola de trabajo', route: '/cola', icon: '🖨️' },
    { label: 'Productos', route: '/productos', icon: '🏷️' },
    { label: 'Insumos', route: '/insumos', icon: '🧵' },
    { label: 'Clientes', route: '/clientes', icon: '👥' },
    { label: 'Ajustes', route: '/ajustes', icon: '⚙️' },
  ];

  readonly bottomNavItems: NavItem[] = [
    { label: 'Ventas', route: '/ventas', icon: '💰' },
    { label: 'Pedidos', route: '/pedidos', icon: '📦' },
    { label: 'Cola', route: '/cola', icon: '🖨️' },
    { label: 'Inicio', route: '/dashboard', icon: '📊', exact: true },
  ];

  ngOnInit(): void {
    void this.realtime.connect();
    this.storeBootstrap.bootstrap();
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
