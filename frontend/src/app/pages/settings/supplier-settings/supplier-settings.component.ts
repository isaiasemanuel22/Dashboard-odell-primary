import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
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
import { Supplier } from '../../../core/models';
import { RealtimeService } from '../../../core/services/realtime.service';
import { SuppliersService } from '../../../core/services/suppliers.service';
import { BreakpointService } from '../../../core/services/breakpoint.service';
import { FormDialogService } from '../../../modals/form-dialog.service';
import { extractApiErrorMessage } from '../../../shared/utils/api-error';

@Component({
  selector: 'app-supplier-settings',
  standalone: true,
  imports: [
    DbButtonComponent,
    DbStateMessageComponent,
    MobileSettingsPageComponent,
    MobileCatalogRowComponent,
    ...DB_DATA_TABLE,
  ],
  templateUrl: './supplier-settings.component.html',
  styleUrl: './supplier-settings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupplierSettingsComponent implements OnInit, OnDestroy {
  private readonly suppliersService = inject(SuppliersService);
  private readonly formDialogs = inject(FormDialogService);
  private readonly breakpoint = inject(BreakpointService);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private messageTimer: ReturnType<typeof setTimeout> | null = null;
  private confirmOpen = false;

  readonly isMobile = this.breakpoint.isMobile;

  suppliers: Supplier[] = [];
  loading = true;
  message = '';

  readonly columns: OdlColumn<Supplier>[] = [
    { key: 'name', header: 'Nombre', type: 'primary' },
    {
      key: 'lead',
      header: 'Demora (días hábiles)',
      align: 'end',
      value: (row) => row.leadTimeBusinessDays,
    },
    {
      key: 'contact',
      header: 'Contacto',
      value: (row) => row.contact?.trim() || '—',
    },
  ];

  readonly actions: OdlRowAction<Supplier>[] = [
    { id: 'editar', label: 'Editar' },
    { id: 'borrar', label: 'Borrar', danger: true },
  ];

  ngOnInit(): void {
    this.reload();
    this.realtime.bindSmartReload(this.destroyRef, ['supplies'], () => {
      this.reload({ silent: true });
    });
  }

  ngOnDestroy(): void {
    this.clearMessageTimer();
  }

  onAction(event: OdlActionEvent<Supplier>): void {
    if (event.actionId === 'editar') this.openEdit(event.row);
    if (event.actionId === 'borrar') this.deleteSupplier(event.row);
  }

  openCreate(): void {
    this.formDialogs.openSupplier(null).subscribe((saved) => {
      if (!saved) return;
      this.flashMessage('Proveedor creado');
      this.reload({ silent: true });
    });
  }

  openEdit(supplier: Supplier): void {
    this.formDialogs.openSupplier(supplier).subscribe((saved) => {
      if (!saved) return;
      this.flashMessage('Proveedor actualizado');
      this.reload({ silent: true });
    });
  }

  deleteSupplier(supplier: Supplier): void {
    if (this.confirmOpen) return;
    this.confirmOpen = true;
    // Diferir para que el click del menú no cierre el confirm al instante.
    setTimeout(() => {
      this.formDialogs
        .openConfirm({
          title: 'Borrar proveedor',
          message: `¿Borrar «${supplier.name}»?`,
          confirmLabel: 'Borrar',
          confirmVariant: 'delete',
        })
        .subscribe({
          next: (confirmed) => {
            this.confirmOpen = false;
            if (!confirmed) {
              this.cdr.markForCheck();
              return;
            }
            this.suppliersService.delete(supplier.id).subscribe({
              next: () => {
                this.flashMessage('Proveedor borrado');
                this.reload({ silent: true });
              },
              error: (err) => {
                this.formDialogs
                  .openConfirm({
                    title: 'No se pudo borrar',
                    message: extractApiErrorMessage(
                      err,
                      'No se puede borrar este proveedor',
                    ),
                    confirmLabel: 'Entendido',
                    alertOnly: true,
                  })
                  .subscribe();
                this.cdr.markForCheck();
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

  mobileSubtitle(supplier: Supplier): string {
    const lead = `${supplier.leadTimeBusinessDays} días hábiles`;
    const contact = supplier.contact?.trim();
    return contact ? `${lead} · ${contact}` : lead;
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
    if (!opts.silent || this.suppliers.length === 0) {
      this.loading = true;
      this.cdr.markForCheck();
    }
    this.suppliersService.list().subscribe({
      next: (items) => {
        this.suppliers = items;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.flashMessage('No se pudieron cargar los proveedores');
        this.cdr.markForCheck();
      },
    });
  }
}
