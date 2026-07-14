import { Component } from '@angular/core';

@Component({
  selector: 'db-form',
  standalone: true,
  template: `<ng-content />`,
  styleUrl: './db-form.component.scss',
  host: { class: 'db-form' },
})
export class DbFormComponent {}
