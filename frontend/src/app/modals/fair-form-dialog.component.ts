import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { DbButtonComponent, DbFormComponent } from '@general-components';
import {
  DbCheckboxComponent,
  DbInputComponent,
  DbSelectComponent,
  DbSelectOption,
} from '@dashboard-form';
import { CalendarService } from '../core/services/calendar.service';
import { CreateFairPayload } from '../core/models';
import { todayIsoDate } from '../shared/utils/fair.util';
import { FormDialogShellComponent } from './form-dialog-shell/form-dialog-shell.component';

export type FairFormDialogResult = CreateFairPayload;

@Component({
  standalone: true,
  imports: [
    FormsModule,
    FormDialogShellComponent,
    DbButtonComponent,
    DbFormComponent,
    DbInputComponent,
    DbSelectComponent,
    DbCheckboxComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    db-form {
      display: flex;
      flex-direction: column;
      gap: 18px;
      padding-bottom: 24px;
      box-sizing: border-box;
    }
  `,
  template: `
    <app-form-dialog-shell
      title="Nueva feria"
      size="md"
      [footerBar]="true"
      (close)="cancel()"
    >
      <db-form>
        <db-input
          label="Nombre"
          name="fairName"
          [(ngModel)]="name"
          placeholder="Ej.: Feria Plaza España"
          [required]="true"
        />
        <db-input label="Fecha" type="date" name="fairDate" [(ngModel)]="date" />
        <db-checkbox label="Se repite" name="fairRecurring" [(ngModel)]="recurring" />
        <db-input
          label="Fondo inicial (opcional)"
          type="number"
          name="fairFloat"
          [(ngModel)]="openingFloat"
          [min]="0"
          hint="Efectivo con el que arrancás la caja. Podés cargarlo al abrir el modo feria."
        />
        @if (entryOptions().length > 1) {
          <db-select
            label="Evento del calendario (opcional)"
            name="fairEntry"
            [(ngModel)]="calendarEntryId"
            [options]="entryOptions()"
          />
        }
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
        label="Crear feria"
        variant="primary"
        format="solid"
        [disabled]="!canSave()"
        (clicked)="confirm()"
      />
    </app-form-dialog-shell>
  `,
})
export class FairFormDialogComponent implements OnInit {
  private readonly dialogRef = inject(DialogRef<FairFormDialogResult | undefined>);
  private readonly calendar = inject(CalendarService);
  readonly data = inject<Record<string, never> | null>(DIALOG_DATA, { optional: true });

  name = '';
  date = todayIsoDate();
  recurring = false;
  openingFloat: number | null = null;
  calendarEntryId = '';
  readonly entryOptions = signal<DbSelectOption[]>([{ value: '', label: 'Sin evento' }]);

  ngOnInit(): void {
    this.calendar.getEntries().subscribe({
      next: (entries) =>
        this.entryOptions.set([
          { value: '', label: 'Sin evento' },
          ...entries.map((entry) => ({
            value: entry.id,
            label: `${entry.title} · ${entry.date}`,
          })),
        ]),
      error: () => undefined,
    });
  }

  canSave(): boolean {
    return !!this.name.trim() && !!this.date;
  }

  cancel(): void {
    this.dialogRef.close(undefined);
  }

  confirm(): void {
    if (!this.canSave()) return;
    const float = Number(this.openingFloat);
    this.dialogRef.close({
      name: this.name.trim(),
      date: this.date,
      recurring: this.recurring,
      calendarEntryId: this.calendarEntryId || null,
      ...(Number.isFinite(float) && float > 0 ? { openingFloat: float } : {}),
    });
  }
}
