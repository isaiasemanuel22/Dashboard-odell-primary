import { NgClass } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';

export interface DbSegmentOption<T extends string = string> {
  value: T;
  label: string;
  /** Clase extra cuando está activo (ej. on-ev / on-rec). */
  activeClass?: string;
}

@Component({
  selector: 'db-segmented-control',
  standalone: true,
  imports: [NgClass],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './db-segmented-control.component.html',
  styleUrl: './db-segmented-control.component.scss',
})
export class DbSegmentedControlComponent<T extends string = string> {
  readonly options = input.required<DbSegmentOption<T>[]>();
  readonly value = input<T | null>(null);
  readonly ariaLabel = input('Opciones');
  readonly size = input<'md' | 'lg'>('md');

  readonly valueChange = output<T>();

  select(option: DbSegmentOption<T>): void {
    this.valueChange.emit(option.value);
  }
}
