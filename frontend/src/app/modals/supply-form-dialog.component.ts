import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { filter } from 'rxjs';
import { Supply, SupplyCategory } from '../core/models';
import { SuppliesService } from '../core/services/settings.service';
import { BreakpointService } from '../core/services/breakpoint.service';
import { FormDialogShellComponent } from './form-dialog-shell/form-dialog-shell.component';
import { MobileFormShellComponent } from '../components/mobile-form-shell/mobile-form-shell.component';
import { confirmMobileFormDiscard } from '../components/mobile-form-shell/confirm-mobile-form-discard';
import type { MobileDockAction } from '../components/mobile-dock/mobile-dock.component';
import { extractApiErrorMessage } from '../shared/utils/api-error';
import { SupplyFormComponent } from '../pages/supplies/supply-form/supply-form.component';
import { FormDialogService } from './form-dialog.service';

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
          [showHeader]="false"
          [dockActions]="mobileDockActions"
          [dockSecondaryFixed]="true"
          discardEntityLabel="el insumo"
          [isDirty]="!!supplyForm?.hasUnsavedChanges()"
          (close)="forceClose()"
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
          @if (supplyForm && !supplyForm.canSubmit && supplyForm.submitMissingLabel) {
            <p dockHint role="status">{{ supplyForm.submitMissingLabel }}</p>
          }
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
  private readonly formDialogs = inject(FormDialogService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogRef = inject(DialogRef<Supply>);
  private readonly data = inject<SupplyFormDialogData>(DIALOG_DATA);

  @ViewChild('supplyForm') supplyForm?: SupplyFormComponent;
  @ViewChild(MobileFormShellComponent)
  private mobileShell?: MobileFormShellComponent;

  readonly isMobile = this.breakpoint.isMobile;

  supply: Supply | null = null;
  defaultCategory?: SupplyCategory;
  loading = false;
  error = '';
  private closing = false;
  private confirmingDiscard = false;

  get mobileDockActions(): MobileDockAction[] {
    const form = this.supplyForm;
    return [
      {
        id: 'cancel',
        label: 'Cancelar',
        kind: 'secondary',
        disabled: this.loading,
      },
      {
        id: 'save',
        label: this.loading
          ? 'Guardando...'
          : this.supply
            ? 'Guardar'
            : 'Crear insumo',
        kind: 'primary',
        disabled: this.loading || !(form?.canSubmit ?? false),
        loading: this.loading,
      },
    ];
  }

  @HostListener('input')
  @HostListener('change')
  onFormEdit(): void {
    this.cdr.markForCheck();
  }

  ngOnInit(): void {
    this.supply = this.data.supply;
    this.defaultCategory = this.data.defaultCategory;
    this.dialogRef.disableClose = true;
    this.dialogRef.backdropClick
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.cancel());
    this.dialogRef.keydownEvents
      .pipe(
        filter((event) => event.key === 'Escape'),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => {
        event.preventDefault();
        this.cancel();
      });
  }

  onMobileDockAction(id: string): void {
    if (id === 'cancel') {
      this.cancel();
      return;
    }
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

  forceClose(): void {
    if (this.closing) return;
    this.closing = true;
    this.dialogRef.close();
  }

  cancel(): void {
    if (this.closing || this.confirmingDiscard) return;

    if (this.isMobile() && this.mobileShell) {
      this.mobileShell.requestClose();
      return;
    }

    this.confirmingDiscard = true;
    confirmMobileFormDiscard(this.formDialogs, {
      hasChanges: !!this.supplyForm?.hasUnsavedChanges(),
      entityLabel: 'el insumo',
    }).subscribe((confirmed) => {
      this.confirmingDiscard = false;
      if (confirmed) this.forceClose();
    });
  }
}
