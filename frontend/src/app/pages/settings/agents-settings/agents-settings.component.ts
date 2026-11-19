import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { forkJoin, map } from 'rxjs';
import {
  DbButtonComponent,
  DbCheckboxComponent,
  DbInputComponent,
  DbStateMessageComponent,
  DB_DATA_TABLE,
  MobileCatalogRowComponent,
  MobileSettingsPageComponent,
  MobileToggleRowComponent,
  OdlActionEvent,
  OdlBadge,
  OdlColumn,
  OdlRowAction,
} from '@general-components';
import { environment } from '../../../../environments/environment';
import {
  AgentApproval,
  AgentToolsSettings,
  ApiKey,
  ApiKeyScopeOption,
  CurrentUserProfile,
} from '../../../core/models';
import { AgentApprovalsService } from '../../../core/services/agent-approvals.service';
import { ApiKeysService } from '../../../core/services/api-keys.service';
import { BreakpointService } from '../../../core/services/breakpoint.service';
import { SettingsService } from '../../../core/services/settings.service';
import { UserAccessService } from '../../../core/services/user-access.service';
import { FormDialogService } from '../../../modals/form-dialog.service';
import { extractApiErrorMessage } from '../../../shared/utils/api-error';
import { formatDateDayMonth } from '../../../shared/utils/date-format.util';

interface McpToolRow {
  key: keyof AgentToolsSettings;
  description: string;
  needsApproval: boolean;
}

@Component({
  selector: 'app-agents-settings',
  standalone: true,
  imports: [
    FormsModule,
    DbButtonComponent,
    DbCheckboxComponent,
    DbInputComponent,
    DbStateMessageComponent,
    MobileSettingsPageComponent,
    MobileCatalogRowComponent,
    MobileToggleRowComponent,
    ...DB_DATA_TABLE,
  ],
  templateUrl: './agents-settings.component.html',
  styleUrl: './agents-settings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgentsSettingsComponent implements OnInit, OnDestroy {
  private readonly apiKeysService = inject(ApiKeysService);
  private readonly approvalsService = inject(AgentApprovalsService);
  private readonly settingsService = inject(SettingsService);
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
  agentTools: AgentToolsSettings | null = null;
  approvals: AgentApproval[] = [];
  approvalsLoading = true;

  readonly mcpUrl = new URL(
    `${environment.apiUrl}/mcp`,
    window.location.origin,
  ).href;

  readonly mcpTools: McpToolRow[] = [
    {
      key: 'consultar_stock',
      description: 'Stock de productos, prendas y filamento',
      needsApproval: false,
    },
    {
      key: 'cotizar_producto',
      description: 'Precio de lista o mayorista según el cliente',
      needsApproval: false,
    },
    {
      key: 'crear_presupuesto',
      description: 'Queda en borrador hasta que lo apruebes',
      needsApproval: true,
    },
    {
      key: 'ver_cola',
      description: 'Fecha de entrega calculada por impresora',
      needsApproval: false,
    },
    {
      key: 'registrar_pago',
      description: 'Marca pagos de un pedido',
      needsApproval: true,
    },
  ];

  readonly toolColumns: OdlColumn<McpToolRow>[] = [
    {
      key: 'key',
      header: 'Herramienta',
      type: 'primary',
      secondary: (row) => row.description,
    },
    {
      key: 'control',
      header: 'Control',
      type: 'badge',
      badge: (row) => this.controlBadge(row),
    },
    { key: 'active', header: 'Activa', type: 'custom', align: 'end' },
  ];

  readonly approvalColumns: OdlColumn<AgentApproval>[] = [
    {
      key: 'kind',
      header: 'Tipo',
      type: 'badge',
      badge: (row) => ({
        label: row.kind === 'payment' ? 'Pago' : 'Presupuesto',
        tone: 'info',
      }),
    },
    {
      key: 'summary',
      header: 'Resumen',
      type: 'primary',
      secondary: (row) =>
        row.status === 'failed' ? `No se pudo: ${row.error ?? ''}` : null,
    },
    { key: 'apiKeyName', header: 'Llave' },
    { key: 'createdAt', header: 'Fecha', type: 'date' },
  ];

  readonly approvalActions: OdlRowAction<AgentApproval>[] = [
    {
      id: 'aprobar',
      label: 'Aprobar',
      hidden: (row) => row.status !== 'pending',
    },
    {
      id: 'rechazar',
      label: 'Rechazar',
      danger: true,
      hidden: (row) => row.status !== 'pending',
    },
  ];

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
    this.loadApprovals();
    this.settingsService.getGeneralSettings().subscribe((settings) => {
      this.agentTools = settings.agentTools;
      this.cdr.markForCheck();
    });
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

  isToolActive(tool: McpToolRow): boolean {
    return !!this.agentTools?.[tool.key];
  }

  toggleTool(key: keyof AgentToolsSettings, value: boolean): void {
    if (!this.agentTools || !this.isAdmin()) return;
    const previous = this.agentTools;
    this.agentTools = { ...previous, [key]: value };
    this.settingsService.updateAgentTools({ [key]: value }).subscribe({
      next: (saved) => {
        this.agentTools = saved;
        this.flashMessage('Herramientas guardadas');
      },
      error: (err) => {
        this.agentTools = previous;
        this.flashMessage(
          extractApiErrorMessage(err, 'No se pudieron guardar las herramientas'),
        );
      },
    });
  }

  copyMcpUrl(): void {
    try {
      void navigator.clipboard.writeText(this.mcpUrl).then(
        () => this.flashMessage('URL copiada'),
        () => this.flashMessage('No se pudo copiar'),
      );
    } catch {
      this.flashMessage('No se pudo copiar');
    }
  }

  controlBadge(tool: McpToolRow): OdlBadge {
    return tool.needsApproval
      ? { label: 'Pide tu aprobación', tone: 'pending' }
      : { label: 'Solo lectura', tone: 'neutral' };
  }

  onApprovalAction(event: OdlActionEvent<AgentApproval>): void {
    this.decide(event.row, event.actionId === 'aprobar');
  }

  decide(approval: AgentApproval, approve: boolean): void {
    const request = approve
      ? this.approvalsService.approve(approval.id)
      : this.approvalsService.reject(approval.id);
    request.subscribe({
      next: (result) => {
        // Si falló al aprobar, queda a la vista con el error.
        this.approvals =
          result.status === 'failed'
            ? this.approvals.map((item) => (item.id === result.id ? result : item))
            : this.approvals.filter((item) => item.id !== result.id);
        this.flashMessage(
          result.status === 'failed'
            ? 'No se pudo aplicar'
            : approve
              ? 'Aprobado'
              : 'Rechazado',
        );
      },
      error: (err) => {
        this.flashMessage(extractApiErrorMessage(err, 'No se pudo resolver'));
        this.loadApprovals();
      },
    });
  }

  approvalSubtitle(approval: AgentApproval): string {
    const base = `${approval.apiKeyName} · ${formatDateDayMonth(approval.createdAt)}`;
    return approval.status === 'failed'
      ? `${base} · No se pudo: ${approval.error ?? ''}`
      : base;
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

  private loadApprovals(): void {
    this.approvalsService.listPending().subscribe({
      next: (items) => {
        this.approvals = items;
        this.approvalsLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.approvalsLoading = false;
        this.cdr.markForCheck();
      },
    });
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
