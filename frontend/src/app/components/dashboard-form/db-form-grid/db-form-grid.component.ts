import { Component, Input } from '@angular/core';

@Component({
  selector: 'db-form-grid',
  standalone: true,
  template: `<ng-content />`,
  styleUrl: './db-form-grid.component.scss',
  host: {
    '[class.db-form-grid]': 'true',
    '[class.db-form-grid--3]': 'columns === 3',
  },
})
export class DbFormGridComponent {
  @Input() columns: 2 | 3 = 2;
}

@Component({
  selector: 'db-form-grid-full',
  standalone: true,
  template: `<ng-content />`,
  styleUrl: './db-form-grid.component.scss',
  host: { class: 'db-form-grid__full' },
})
export class DbFormGridFullComponent {}
