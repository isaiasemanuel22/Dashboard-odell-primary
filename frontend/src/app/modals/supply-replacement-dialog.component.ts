import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import {
  DbAutocompleteComponent,
  DbAutocompleteOption,
  DbButtonComponent,
} from '@general-components';
import {
  SupplyReplacementCandidate,
  SupplyReplacementChoice,
  SupplyShortageReport,
} from '../core/models';
import { FormDialogShellComponent } from './form-dialog-shell/form-dialog-shell.component';

@Component({
  standalone: true,
  imports: [
    FormsModule,
    FormDialogShellComponent,
    DbButtonComponent,
    DbAutocompleteComponent,
  ],
  template: `
    <app-form-dialog-shell
      title="Insumos insuficientes"
      size="md"
      (close)="cancel()"
    >
      <ul class="shortage-list">
        @for (line of data.missing; track line.key) {
          <li>{{ line.label }}</li>
        }
      </ul>
      <p class="shortage-ask">¿Le gustaría reemplazarlo?</p>
      @for (line of data.missing; track line.key) {
        <db-autocomplete
          [label]="'Reemplaza: ' + line.label"
          [name]="'reemplazo-' + line.key"
          placeholder="Buscar insumo de la misma categoría"
          [options]="optionsFor(line.category)"
          [allowCreate]="false"
          [ngModel]="labelFor(line.key)"
          (optionSelected)="pick(line.key, $event)"
        />
      }
      <div class="shortage-actions">
        <db-button
          label="Cancelar"
          variant="secondary"
          format="soft"
          (clicked)="cancel()"
        />
        <db-button
          label="Reemplazar y continuar"
          variant="primary"
          format="solid"
          [disabled]="!canConfirm"
          (clicked)="confirm()"
        />
      </div>
    </app-form-dialog-shell>
  `,
  styles: `
    .shortage-list {
      margin: 0 0 0.75rem;
      padding-left: 1.1rem;
      color: var(--color-text, #0f172a);
    }

    .shortage-ask {
      margin: 0 0 1rem;
      font-weight: 700;
    }

    .shortage-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      margin-top: 1.25rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupplyReplacementDialogComponent {
  readonly data = inject<SupplyShortageReport>(DIALOG_DATA);
  private readonly dialogRef =
    inject(DialogRef<SupplyReplacementChoice[] | undefined>);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly chosen = new Map<string, string>();

  get canConfirm(): boolean {
    return this.data.missing.every((line) => this.chosen.has(line.key));
  }

  optionsFor(category: string): DbAutocompleteOption[] {
    return this.data.candidates
      .filter((item) => item.category === category)
      .map((item) => ({
        value: item.id,
        label: item.detail ? `${item.name} · ${item.detail}` : item.name,
      }));
  }

  labelFor(key: string): string {
    const id = this.chosen.get(key);
    if (!id) return '';
    const candidate = this.data.candidates.find((item) => item.id === id);
    if (!candidate) return '';
    return candidate.detail
      ? `${candidate.name} · ${candidate.detail}`
      : candidate.name;
  }

  pick(key: string, option: DbAutocompleteOption): void {
    this.chosen.set(key, option.value);
    this.cdr.markForCheck();
  }

  confirm(): void {
    if (!this.canConfirm) return;
    const choices: SupplyReplacementChoice[] = this.data.missing.map(
      (line) => ({
        requirementKey: line.key,
        supplyId: this.chosen.get(line.key)!,
      }),
    );
    this.dialogRef.close(choices);
  }

  cancel(): void {
    this.dialogRef.close(undefined);
  }
}
