import { Component, Input } from '@angular/core';

@Component({
  selector: 'db-form-field',
  standalone: true,
  templateUrl: './db-form-field.component.html',
  styleUrl: './db-form-field.component.scss',
})
export class DbFormFieldComponent {
  @Input() label = '';
  @Input() hint = '';
  @Input() error = '';
  @Input() required = false;
  @Input() forId = '';
}
