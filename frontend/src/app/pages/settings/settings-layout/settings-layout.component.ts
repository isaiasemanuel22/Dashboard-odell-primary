import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { DbButtonComponent } from '@general-components';
import { FormDialogService } from '../../../modals/public-api';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-settings-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    DbButtonComponent,
  ],
  templateUrl: './settings-layout.component.html',
  styleUrl: './settings-layout.component.scss',
})
export class SettingsLayoutComponent {
  private readonly formDialogs = inject(FormDialogService);
  /** El reseteo de base solo se ofrece fuera de producción. */
  readonly showReset = !environment.production;

  openResetModal(): void {
    this.formDialogs.openResetDatabase().subscribe();
  }
}
