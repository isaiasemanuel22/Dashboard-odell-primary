import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-user-access-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="access-pills">
      <a class="access-pill" routerLink="/ajustes/usuarios/usuarios" routerLinkActive="access-pill--active">
        Usuarios
      </a>
      <a class="access-pill" routerLink="/ajustes/usuarios/roles" routerLinkActive="access-pill--active">
        Roles
      </a>
      <a class="access-pill" routerLink="/ajustes/usuarios/areas" routerLinkActive="access-pill--active">
        Áreas
      </a>
    </nav>
  `,
  styleUrl: './user-access-layout.component.scss',
})
export class UserAccessNavComponent {}
