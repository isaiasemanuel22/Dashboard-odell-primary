import { Component } from '@angular/core';

@Component({
  selector: 'db-form-footer',
  standalone: true,
  template: `<footer class="db-form-footer"><ng-content /></footer>`,
  styleUrl: './db-form-footer.component.scss',
})
export class DbFormFooterComponent {}
