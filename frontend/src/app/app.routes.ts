import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guard';
import { LayoutComponent } from './layout/layout.component';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent,
          ),
      },
      {
        path: 'ventas',
        loadComponent: () =>
          import('./pages/sales/sales.component').then(
            (m) => m.SalesComponent,
          ),
      },
      {
        path: 'pedidos',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./pages/orders/orders.component').then(
                (m) => m.OrdersComponent,
              ),
          },
          {
            path: ':id',
            loadComponent: () =>
              import('./pages/orders/order-detail/order-detail.component').then(
                (m) => m.OrderDetailComponent,
              ),
          },
        ],
      },
      {
        path: 'cola',
        loadComponent: () =>
          import('./pages/print-jobs/print-jobs.component').then(
            (m) => m.PrintJobsComponent,
          ),
      },
      {
        path: 'productos',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./pages/products/products.component').then(
                (m) => m.ProductsComponent,
              ),
          },
          {
            path: ':id',
            loadComponent: () =>
              import('./pages/products/product-detail/product-detail.component').then(
                (m) => m.ProductDetailComponent,
              ),
          },
        ],
      },
      {
        path: 'insumos',
        loadComponent: () =>
          import('./pages/supplies/supplies.component').then(
            (m) => m.SuppliesComponent,
          ),
      },
      {
        path: 'clientes',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./pages/customers/customers.component').then(
                (m) => m.CustomersComponent,
              ),
          },
          {
            path: ':id',
            loadComponent: () =>
              import('./pages/customers/customer-detail/customer-detail.component').then(
                (m) => m.CustomerDetailComponent,
              ),
          },
        ],
      },
      {
        path: 'ajustes',
        loadComponent: () =>
          import('./pages/settings/settings-layout/settings-layout.component').then(
            (m) => m.SettingsLayoutComponent,
          ),
        children: [
          { path: '', redirectTo: 'valores-generales', pathMatch: 'full' },
          {
            path: 'valores-generales',
            loadComponent: () =>
              import('./pages/settings/general-values/general-values.component').then(
                (m) => m.GeneralValuesComponent,
              ),
          },
          {
            path: 'filamento',
            loadComponent: () =>
              import('./pages/settings/filament-settings/filament-settings.component').then(
                (m) => m.FilamentSettingsComponent,
              ),
          },
          {
            path: 'resina',
            loadComponent: () =>
              import('./pages/settings/resin-settings/resin-settings.component').then(
                (m) => m.ResinSettingsComponent,
              ),
          },
          {
            path: 'impresos',
            loadComponent: () =>
              import('./pages/settings/impresos-settings/impresos-settings.component').then(
                (m) => m.ImpresosSettingsComponent,
              ),
          },
          {
            path: 'ganancias',
            loadComponent: () =>
              import('./pages/settings/profit-settings/profit-settings.component').then(
                (m) => m.ProfitSettingsComponent,
              ),
          },
        ],
      },
      { path: 'materiales', redirectTo: 'insumos', pathMatch: 'full' },
      { path: 'impresos', redirectTo: 'ajustes/impresos', pathMatch: 'full' },
    ],
  },
];
