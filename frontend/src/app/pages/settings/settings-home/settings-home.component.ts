import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { map } from 'rxjs';
import { BreakpointService } from '../../../core/services/breakpoint.service';
import { SettingsService } from '../../../core/services/settings.service';
import { UserAccessService } from '../../../core/services/user-access.service';
import { ImpresosService } from '../../../core/services/impresos.service';
import { FormDialogService } from '../../../modals/public-api';
import {
  MobileBarComponent,
  MobileNavListComponent,
  type MobileNavGroup,
  type MobileNavItem,
} from '@general-components';
import { CurrentUserProfile, GeneralSettings } from '../../../core/models';

@Component({
  selector: 'app-settings-home',
  standalone: true,
  imports: [MobileBarComponent, MobileNavListComponent],
  templateUrl: './settings-home.component.html',
  styleUrl: './settings-home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsHomeComponent implements OnInit {
  private readonly breakpoint = inject(BreakpointService);
  private readonly router = inject(Router);
  private readonly settingsService = inject(SettingsService);
  private readonly impresosService = inject(ImpresosService);
  private readonly userAccess = inject(UserAccessService);
  private readonly formDialogs = inject(FormDialogService);

  private readonly settings = toSignal(
    this.settingsService.watchGeneralSettings(),
    { initialValue: null as GeneralSettings | null },
  );

  private readonly impresosCount = toSignal(
    this.impresosService.getImpresos().pipe(map((items) => items.length)),
    { initialValue: 0 },
  );

  private readonly usersCount = toSignal(
    this.userAccess.listUsers().pipe(map((users) => users.length)),
    { initialValue: 0 },
  );

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

  readonly filamentSummary = computed(() => {
    const s = this.settings();
    if (!s) return 'Precios por marca';
    const types = s.filamentTypes?.length ?? 0;
    const noun = types === 1 ? 'tipo' : 'tipos';
    return `${types} ${noun} · precios por marca`;
  });

  readonly resinSummary = computed(() => {
    const s = this.settings();
    if (!s) return 'Precios por litro';
    const types = s.resinTypes?.length ?? 0;
    const noun = types === 1 ? 'tipo' : 'tipos';
    return `${types} ${noun} · precios por litro`;
  });

  readonly impresosSummary = computed(() => {
    const n = this.impresosCount();
    const noun = n === 1 ? 'papel' : 'papeles';
    return `${n} ${noun} para estampado`;
  });

  readonly gainsSummary = computed(() => {
    const s = this.settings();
    if (!s?.wholesaleDiscount) return 'Márgenes y descuento por mayor';
    const pct = s.wholesaleDiscount.percent;
    if (!s.wholesaleDiscount.enabled) return 'Márgenes y descuento por mayor';
    return `Márgenes y descuento por mayor −${pct} %`;
  });

  readonly colorsSummary = computed(() => {
    const n = this.settings()?.colors?.length ?? 0;
    const noun = n === 1 ? 'color' : 'colores';
    return `${n} ${noun}`;
  });

  readonly usersSummary = computed(() => {
    const n = this.usersCount();
    const noun = n === 1 ? 'usuario' : 'usuarios';
    return `${n} ${noun} · solo administradores`;
  });

  readonly navGroups = computed((): MobileNavGroup[] => [
    {
      title: 'Costos y precios',
      items: [
        {
          label: 'Valores generales',
          hint: 'Mano de obra, luz, margen de error, equipos',
          link: '/ajustes/valores-generales',
        },
        {
          label: 'Filamento',
          hint: this.filamentSummary(),
          link: '/ajustes/filamento',
        },
        {
          label: 'Resina',
          hint: this.resinSummary(),
          link: '/ajustes/resina',
        },
        {
          label: 'Impresos',
          hint: this.impresosSummary(),
          link: '/ajustes/impresos',
        },
        {
          label: 'Ganancias',
          hint: this.gainsSummary(),
          link: '/ajustes/ganancias',
        },
      ],
    },
    {
      title: 'Catálogos',
      items: [
        {
          label: 'Colores',
          hint: this.colorsSummary(),
          link: '/ajustes/colores',
        },
      ],
    },
    {
      title: 'Equipo',
      items: [
        {
          label: 'Usuarios, roles y áreas',
          hint: this.usersSummary(),
          link: '/ajustes/usuarios',
        },
      ],
    },
    {
      title: 'Zona de cuidado',
      items: [
        {
          id: 'reset-db',
          label: 'Resetear base de datos',
          hint: 'Solo administrador · pide un código',
          danger: true,
          action: this.isAdmin(),
        },
      ],
    },
  ]);

  ngOnInit(): void {
    if (!this.breakpoint.isMobile()) {
      void this.router.navigateByUrl('/ajustes/valores-generales', {
        replaceUrl: true,
      });
      return;
    }
    this.settingsService.getGeneralSettings(false).subscribe();
  }

  openResetModal(): void {
    this.formDialogs.openResetDatabase().subscribe();
  }

  onNavAction(item: MobileNavItem): void {
    if (item.id === 'reset-db' && this.isAdmin()) {
      this.openResetModal();
    }
  }
}
