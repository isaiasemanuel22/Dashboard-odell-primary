import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MobileSettingsPageComponent } from '@general-components';

@Component({
  selector: 'app-settings-users-mobile-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, MobileSettingsPageComponent],
  templateUrl: './settings-users-mobile-shell.component.html',
  styleUrl: './settings-users-mobile-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsUsersMobileShellComponent {}
