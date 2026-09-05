import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-user-access-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './user-access-layout.component.html',
  styleUrl: './user-access-layout.component.scss',
})
export class UserAccessLayoutComponent {}
