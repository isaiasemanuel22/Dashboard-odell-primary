import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppRole } from '../../../../core/models';
import { DbButtonComponent, DbCheckboxComponent, DbInputComponent } from '@general-components';

export interface UsersAdminFormValue {
  email: string;
  displayName: string;
  firebaseUid: string;
  active: boolean;
  roleIds: string[];
}

@Component({
  selector: 'app-users-admin-form',
  standalone: true,
  imports: [FormsModule, DbInputComponent, DbCheckboxComponent, DbButtonComponent],
  templateUrl: './users-admin-form.component.html',
  styleUrl: '../user-access-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersAdminFormComponent {
  @Input() error = '';
  @Input({ required: true }) form!: UsersAdminFormValue;
  @Input() roles: AppRole[] = [];
  @Input() saving = false;

  @Output() roleToggle = new EventEmitter<{ roleId: string; checked: boolean }>();
  @Output() cancelEdit = new EventEmitter<void>();
  @Output() save = new EventEmitter<void>();
}
