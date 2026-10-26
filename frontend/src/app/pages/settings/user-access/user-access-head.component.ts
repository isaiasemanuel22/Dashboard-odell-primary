import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-user-access-head',
  standalone: true,
  template: `
    <header class="access-head">
      <div>
        <h3>Usuarios y permisos</h3>
        <p>{{ detail }}</p>
      </div>
      <ng-content />
    </header>
  `,
  styleUrl: './user-access-layout.component.scss',
})
export class UserAccessHeadComponent {
  @Input() detail = 'Perfiles, roles y áreas de trabajo';
}
