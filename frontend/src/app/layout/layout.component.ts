import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { RealtimeService } from '../core/services/realtime.service';
import { ReferenceDataService } from '../core/services/reference-data.service';
import { DbButtonComponent } from '@general-components';

interface NavItem {
  label: string;
  route: string;
  icon: string;
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
  private readonly referenceData = inject(ReferenceDataService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly user$ = this.auth.currentUser$;
  readonly authEnabled = this.auth.enabled;

  readonly navItems: NavItem[] = [
    { label: 'Dashboard', route: '/dashboard', icon: '📊' },
    { label: 'Ventas', route: '/ventas', icon: '💰' },
    { label: 'Pedidos', route: '/pedidos', icon: '📦' },
    { label: 'Cola de trabajo', route: '/cola', icon: '🖨️' },
    { label: 'Productos', route: '/productos', icon: '🏷️' },
    { label: 'Insumos', route: '/insumos', icon: '🧵' },
    { label: 'Clientes', route: '/clientes', icon: '👥' },
    { label: 'Ajustes', route: '/ajustes', icon: '⚙️' },
  ];

  ngOnInit(): void {
    void this.realtime.connect();
    void this.referenceData.load().subscribe();
    this.destroyRef.onDestroy(() => this.realtime.disconnect());
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/login');
  }
}
