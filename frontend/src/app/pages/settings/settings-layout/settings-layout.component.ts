import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { DbButtonComponent } from '@general-components';
import { FormDialogService } from '../../../shared/form-dialogs/public-api';

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

  openResetModal(): void {
    this.formDialogs.openResetDatabase().subscribe();
  }
}
