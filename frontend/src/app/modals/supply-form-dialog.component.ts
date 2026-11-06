import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Supply, SupplyCategory } from '../core/models';
import { SuppliesService } from '../core/services/settings.service';
import { BreakpointService } from '../core/services/breakpoint.service';
import { FormDialogShellComponent } from './form-dialog-shell/form-dialog-shell.component';
import { MobileFormShellComponent } from '../components/mobile-form-shell/mobile-form-shell.component';
import type { MobileDockAction } from '../components/mobile-dock/mobile-dock.component';
import { extractApiErrorMessage } from '../shared/utils/api-error';
import { SupplyFormComponent } from '../pages/supplies/supply-form/supply-form.component';

export interface SupplyFormDialogData {
  supply: Supply | null;
  defaultCategory?: SupplyCategory;
}

@Component({
  standalone: true,
  imports: [
    FormDialogShellComponent,
    MobileFormShellComponent,
    SupplyFormComponent,
  ],
  template: `
    <app-form-dialog-shell
      [title]="supply ? 'Editar insumo' : 'Nuevo insumo'"
      size="md"
      (close)="cancel()"
    >
      @if (isMobile()) {
        <db-mobile-form-shell
          [title]="supply ? 'Editar insumo' : 'Nuevo insumo'"
          [dockActions]="mobileDockActions"
          (close)="cancel()"
          (dockAction)="onMobileDockAction($event)"
        >
          <app-supply-form
            #supplyForm
            [supply]="supply"
            [defaultCategory]="defaultCategory"
            [loading]="loading"
            [error]="error"
            [hideFooter]="true"
            (save)="save($event)"
            (cancel)="cancel()"
          />
        </db-mobile-form-shell>
      } @else {
        <app-supply-form
          [supply]="supply"
          [defaultCategory]="defaultCategory"
          [loading]="loading"
          [error]="error"
          (save)="save($event)"
          (cancel)="cancel()"
        />
      }
    </app-form-dialog-shell>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupplyFormDialogComponent implements OnInit {
  private readonly suppliesService = inject(SuppliesService);
  private readonly breakpoint = inject(BreakpointService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly dialogRef = inject(DialogRef<Supply>);
  private readonly data = inject<SupplyFormDialogData>(DIALOG_DATA);

  @ViewChild('supplyForm') private supplyForm?: SupplyFormComponent;

  readonly isMobile = this.breakpoint.isMobile;

  supply: Supply | null = null;
  defaultCategory?: SupplyCategory;
  loading = false;
  error = '';

  get mobileDockActions(): MobileDockAction[] {
    return [
      {
        id: 'save',
        label: this.loading
          ? 'Guardando...'
          : this.supply
            ? 'Guardar'
            : 'Crear insumo',
        kind: 'primary',
        disabled: this.loading,
        loading: this.loading,
      },
    ];
  }

  ngOnInit(): void {
    this.supply = this.data.supply;
    this.defaultCategory = this.data.defaultCategory;
  }

  onMobileDockAction(id: string): void {
    if (id === 'save') {
      this.supplyForm?.onSubmit();
    }
  }

  save(data: Partial<Supply>): void {
    this.loading = true;
    this.error = '';
    this.cdr.markForCheck();

    const request = this.supply
      ? this.suppliesService.updateSupply(this.supply.id, data)
      : this.suppliesService.createSupply(
          data as Omit<Supply, 'id' | 'updatedAt'>,
        );

    request.subscribe({
      next: (saved) => {
        this.loading = false;
        this.dialogRef.close(saved);
      },
      error: (err) => {
        this.loading = false;
        this.error = extractApiErrorMessage(err, 'Error al guardar');
        this.cdr.markForCheck();
      },
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
