import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MobileBarComponent } from '@general-components';

@Component({
  selector: 'app-settings-users-mobile-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, MobileBarComponent],
  templateUrl: './settings-users-mobile-shell.component.html',
  styleUrl: './settings-users-mobile-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsUsersMobileShellComponent {}
