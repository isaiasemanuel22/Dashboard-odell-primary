import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import {
  DbButtonComponent,
  DbFormComponent,
  DbFormGridComponent,
} from '@general-components';
import {
  DbInputComponent,
  DbSelectComponent,
  DbSelectOption,
} from '@dashboard-form';
import { ServiceType } from '../core/models';
import { OrderResponsibleOption } from '../core/services/user-access.service';
import { serviceTypeLabel } from '../shared/constants/labels';
import { FormDialogShellComponent } from './form-dialog-shell/form-dialog-shell.component';

export interface IndependentTaskDialogData {
  responsibles: OrderResponsibleOption[];
  defaultResponsibleId: string;
}

export interface IndependentTaskDialogResult {
  productName: string;
  /** Vacío cuando la tarea no tiene área. */
  type: ServiceType | '';
  dueDate: string;
  responsibleUserId?: string;
  estimatedHours: number;
}

const AREAS: ServiceType[] = [
  ServiceType.IMPRESION_3D,
  ServiceType.ESTAMPADO,
  ServiceType.DISENO_GRAFICO,
  ServiceType.MODELADO,
];

@Component({
  standalone: true,
  imports: [
    FormsModule,
    FormDialogShellComponent,
    DbButtonComponent,
    DbFormComponent,
    DbFormGridComponent,
    DbInputComponent,
    DbSelectComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    /* El gap de .db-form no llega al host: se fija acá, igual que en el resto de modales. */
    db-form {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    db-form-grid {
      gap: 1.5rem 1rem;
      align-items: start;
    }

    db-form ::ng-deep .db-form-field {
      gap: 0.5rem;
    }

    @media (max-width: 768px) {
      db-form {
        gap: 14px;
      }

      db-form-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }
    }
  `,
  template: `
    <app-form-dialog-shell
      title="Nueva tarea"
      size="ml"
      [footerBar]="true"
      (close)="cancel()"
    >
      <db-form>
        <db-input
          label="Nombre"
          name="taskName"
          [(ngModel)]="productName"
          placeholder="Ej.: Producir 10 llaveros para stock"
          [required]="true"
        />
        <db-select
          label="Área"
          name="taskArea"
          [(ngModel)]="type"
          [options]="areaOptions"
        />
        <db-form-grid>
          <db-input
            label="Fecha límite"
            type="date"
            name="taskDue"
            [(ngModel)]="dueDate"
          />
          <db-input
            label="Horas estimadas"
            type="number"
            name="taskHours"
            [(ngModel)]="estimatedHours"
            [min]="0"
            [step]="0.5"
          />
        </db-form-grid>
        <db-select
          label="Responsable"
          name="taskResponsible"
          [(ngModel)]="responsibleUserId"
          [options]="responsibleOptions"
        />
      </db-form>
      <db-button
        modalFooter
        label="Cancelar"
        variant="secondary"
        format="soft"
        (clicked)="cancel()"
      />
      <db-button
        modalFooter
        label="Crear tarea"
        variant="primary"
        format="solid"
        [disabled]="!productName.trim()"
        (clicked)="confirm()"
      />
    </app-form-dialog-shell>
  `,
})
export class IndependentTaskDialogComponent {
  private readonly dialogRef = inject(
    DialogRef<IndependentTaskDialogResult | undefined>,
  );
  readonly data = inject<IndependentTaskDialogData>(DIALOG_DATA);

  productName = '';
  type: ServiceType | '' = '';
  dueDate = defaultDueDate();
  responsibleUserId = this.data.defaultResponsibleId;
  estimatedHours = 1;

  readonly areaOptions: DbSelectOption[] = [
    { value: '', label: 'Sin área' },
    ...AREAS.map((value) => ({
      value,
      label: serviceTypeLabel(value),
    })),
  ];

  get responsibleOptions(): DbSelectOption[] {
    return this.data.responsibles.map((user) => ({
      value: user.firebaseUid,
      label: user.displayName,
    }));
  }

  cancel(): void {
    this.dialogRef.close(undefined);
  }

  confirm(): void {
    const productName = this.productName.trim();
    if (!productName) return;
    this.dialogRef.close({
      productName,
      type: this.type || '',
      dueDate: this.dueDate,
      responsibleUserId: this.responsibleUserId || undefined,
      estimatedHours: Math.max(0, Number(this.estimatedHours) || 0),
    });
  }
}

function defaultDueDate(): string {
  const due = new Date();
  due.setDate(due.getDate() + 7);
  const year = due.getFullYear();
  const month = String(due.getMonth() + 1).padStart(2, '0');
  const day = String(due.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
