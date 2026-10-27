import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';

export interface DbPillOption<T extends string = string> {
  value: T;
  label: string;
}

export type DbPillSize = 'md' | 'sm';

@Component({
  selector: 'db-pill-group',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './db-pill-group.component.html',
  styleUrl: './db-pill-group.component.scss',
})
export class DbPillGroupComponent<T extends string = string> {
  /** Opciones del grupo (value + label). */
  readonly options = input.required<DbPillOption<T>[]>();
  /** Valor seleccionado. */
  readonly value = input<T | null>(null);
  /** Etiqueta opcional a la izquierda (ej. «Área»). */
  readonly label = input<string | null>(null);
  /** Nombre accesible del grupo. */
  readonly ariaLabel = input('Filtros');
  /** `md` = filtros de estado; `sm` = filtros de área. */
  readonly size = input<DbPillSize>('md');

  readonly valueChange = output<T>();

  select(option: DbPillOption<T>): void {
    this.valueChange.emit(option.value);
  }
}
