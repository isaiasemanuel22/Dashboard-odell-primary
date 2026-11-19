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
import { forkJoin, map } from 'rxjs';
import {
  DbButtonComponent,
  DbStateMessageComponent,
  DB_DATA_TABLE,
  MobileCatalogRowComponent,
  MobileSettingsPageComponent,
  OdlActionEvent,
  OdlColumn,
  OdlRowAction,
} from '@general-components';
import {
  ApiKey,
  ApiKeyScopeOption,
  CurrentUserProfile,
} from '../../../core/models';
import { ApiKeysService } from '../../../core/services/api-keys.service';
import { BreakpointService } from '../../../core/services/breakpoint.service';
import { UserAccessService } from '../../../core/services/user-access.service';
import { FormDialogService } from '../../../modals/form-dialog.service';
import { extractApiErrorMessage } from '../../../shared/utils/api-error';
import { formatDateDayMonth } from '../../../shared/utils/date-format.util';

@Component({
  selector: 'app-agents-settings',
  standalone: true,
  imports: [
    DbButtonComponent,
    DbStateMessageComponent,
    MobileSettingsPageComponent,
    MobileCatalogRowComponent,
    ...DB_DATA_TABLE,
  ],
  templateUrl: './agents-settings.component.html',
  styleUrl: './agents-settings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgentsSettingsComponent implements OnInit, OnDestroy {
  private readonly apiKeysService = inject(ApiKeysService);
  private readonly formDialogs = inject(FormDialogService);
  private readonly breakpoint = inject(BreakpointService);
  private readonly userAccess = inject(UserAccessService);
  private readonly cdr = inject(ChangeDetectorRef);
  private messageTimer: ReturnType<typeof setTimeout> | null = null;
  private confirmOpen = false;

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

  apiKeys: ApiKey[] = [];
  scopeOptions: ApiKeyScopeOption[] = [];
  loading = true;
  message = '';

  readonly columns: OdlColumn<ApiKey>[] = [
    {
      key: 'name',
      header: 'Nombre',
      type: 'primary',
      secondary: (row) => row.displayPrefix,
    },
    {
      key: 'scopes',
      header: 'Permisos',
      value: (row) => this.scopesLabel(row),
    },
    {
      key: 'lastUsed',
      header: 'Último uso',
      value: (row) => this.statusLabel(row),
    },
  ];

  readonly actions: OdlRowAction<ApiKey>[] = [
    {
      id: 'revocar',
      label: 'Revocar',
      danger: true,
      hidden: (row) => !!row.revokedAt,
    },
  ];

  ngOnInit(): void {
    this.reload();
  }

  ngOnDestroy(): void {
    this.clearMessageTimer();
  }

  onAction(event: OdlActionEvent<ApiKey>): void {
    if (event.actionId === 'revocar') this.revoke(event.row);
  }

  openCreate(): void {
    this.formDialogs.openApiKey(this.scopeOptions).subscribe((created) => {
      if (!created) return;
      this.flashMessage('Llave creada');
      this.reload({ silent: true });
    });
  }

  revoke(apiKey: ApiKey): void {
    if (this.confirmOpen || apiKey.revokedAt) return;
    this.confirmOpen = true;
    // Diferir para que el click del menú no cierre el confirm al instante.
    setTimeout(() => {
      this.formDialogs
        .openConfirm({
          title: 'Revocar llave',
          message: `¿Revocar «${apiKey.name}»? El agente deja de tener acceso al instante.`,
          confirmLabel: 'Revocar',
          confirmVariant: 'delete',
        })
        .subscribe({
          next: (confirmed) => {
            this.confirmOpen = false;
            if (!confirmed) {
              this.cdr.markForCheck();
              return;
            }
            this.apiKeysService.revoke(apiKey.id).subscribe({
              next: () => {
                this.flashMessage('Llave revocada');
                this.reload({ silent: true });
              },
              error: (err) => {
                this.flashMessage(
                  extractApiErrorMessage(err, 'No se pudo revocar la llave'),
                );
              },
            });
          },
          error: () => {
            this.confirmOpen = false;
            this.cdr.markForCheck();
          },
        });
    }, 0);
  }

  scopesLabel(apiKey: ApiKey): string {
    return apiKey.scopes
      .map(
        (id) => this.scopeOptions.find((option) => option.id === id)?.label ?? id,
      )
      .join(', ');
  }

  statusLabel(apiKey: ApiKey): string {
    if (apiKey.revokedAt) return 'Revocada';
    return apiKey.lastUsedAt ? formatDateDayMonth(apiKey.lastUsedAt) : 'Nunca';
  }

  mobileSubtitle(apiKey: ApiKey): string {
    return `${apiKey.displayPrefix} · ${this.statusLabel(apiKey)}`;
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

  private reload(opts: { silent?: boolean } = {}): void {
    if (!opts.silent || this.apiKeys.length === 0) {
      this.loading = true;
      this.cdr.markForCheck();
    }
    forkJoin([this.apiKeysService.list(), this.apiKeysService.scopes()]).subscribe({
      next: ([items, scopes]) => {
        this.apiKeys = items;
        this.scopeOptions = scopes;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.flashMessage('No se pudieron cargar las llaves');
        this.cdr.markForCheck();
      },
    });
  }
}
