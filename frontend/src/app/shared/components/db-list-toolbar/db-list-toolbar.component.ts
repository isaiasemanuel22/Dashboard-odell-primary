import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface ListFilterOption<T extends string = string> {
  value: T;
  label: string;
}

@Component({
  selector: 'db-list-toolbar',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './db-list-toolbar.component.html',
  styleUrl: './db-list-toolbar.component.scss',
})
export class DbListToolbarComponent<T extends string = string> {
  @Input() filters: ListFilterOption<T>[] = [];
  @Input() activeFilter: T | null = null;
  @Input() search = '';
  @Input() searchPlaceholder = 'Buscar...';
  @Input() showSearch = true;

  @Output() filterChange = new EventEmitter<T>();
  @Output() searchChange = new EventEmitter<string>();

  onFilterClick(value: T): void {
    this.filterChange.emit(value);
  }

  onSearchInput(value: string): void {
    this.searchChange.emit(value);
  }
}
