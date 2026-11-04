import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { DbButtonComponent } from '@general-components';
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
    DbInputComponent,
    DbSelectComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-form-dialog-shell title="Nueva tarea" size="md" (close)="cancel()">
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
      <db-input
        label="Fecha límite"
        type="date"
        name="taskDue"
        [(ngModel)]="dueDate"
      />
      <db-select
        label="Responsable"
        name="taskResponsible"
        [(ngModel)]="responsibleUserId"
        [options]="responsibleOptions"
      />
      <db-input
        label="Horas estimadas"
        type="number"
        name="taskHours"
        [(ngModel)]="estimatedHours"
        [min]="0"
        [step]="0.5"
      />
      <div class="task-actions">
        <db-button
          label="Cancelar"
          variant="secondary"
          format="soft"
          (clicked)="cancel()"
        />
        <db-button
          label="Crear tarea"
          variant="primary"
          format="solid"
          [disabled]="!productName.trim()"
          (clicked)="confirm()"
        />
      </div>
    </app-form-dialog-shell>
  `,
  styles: `
    .task-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      margin-top: 1rem;
    }
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
  return due.toISOString().slice(0, 10);
}
