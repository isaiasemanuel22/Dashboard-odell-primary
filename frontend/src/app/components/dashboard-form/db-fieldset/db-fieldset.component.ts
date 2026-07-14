import { Component, Input } from '@angular/core';

@Component({
  selector: 'db-fieldset',
  standalone: true,
  templateUrl: './db-fieldset.component.html',
  styleUrl: './db-fieldset.component.scss',
})
export class DbFieldsetComponent {
  @Input() legend = '';
}
