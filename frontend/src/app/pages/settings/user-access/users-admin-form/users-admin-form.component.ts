import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppRole } from '../../../../core/models';
import { BreakpointService } from '../../../../core/services/breakpoint.service';
import {
  DbButtonComponent,
  DbCheckboxComponent,
  DbInputComponent,
  MobileChipGroupComponent,
  MobileChipOption,
  MobileFieldGroupComponent,
  MobileToggleRowComponent,
} from '@general-components';

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
  imports: [
    FormsModule,
    DbInputComponent,
    DbCheckboxComponent,
    DbButtonComponent,
    MobileFieldGroupComponent,
    MobileToggleRowComponent,
    MobileChipGroupComponent,
  ],
  templateUrl: './users-admin-form.component.html',
  styleUrl: '../user-access-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersAdminFormComponent {
  private readonly breakpoint = inject(BreakpointService);
  readonly isMobile = this.breakpoint.isMobile;

  @Input() error = '';
  @Input({ required: true }) form!: UsersAdminFormValue;
  @Input() roles: AppRole[] = [];
  @Input() saving = false;

  @Output() roleToggle = new EventEmitter<{ roleId: string; checked: boolean }>();
  @Output() cancelEdit = new EventEmitter<void>();
  @Output() save = new EventEmitter<void>();

  get roleChipOptions(): MobileChipOption[] {
    return this.roles.map((role) => ({
      value: role.id,
      label: role.name,
    }));
  }

  onRoleChipsChange(values: string[]): void {
    const next = new Set(values);
    for (const role of this.roles) {
      const checked = next.has(role.id);
      const was = this.form.roleIds.includes(role.id);
      if (checked !== was) {
        this.roleToggle.emit({ roleId: role.id, checked });
      }
    }
  }
}
