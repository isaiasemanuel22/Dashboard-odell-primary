import { Component } from '@angular/core';

@Component({
  selector: 'db-form-error',
  standalone: true,
  template: `<p class="db-form-error"><ng-content /></p>`,
  styleUrl: './db-form-error.component.scss',
})
export class DbFormErrorComponent {}
