import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ADMIN_PERMISSION_ACTIONS,
  AppRole,
  PermissionAction,
  RolePermissionEntry,
  WORK_PERMISSION_ACTIONS,
  WorkArea,
} from '../../../core/models';
import { UserAccessService } from '../../../core/services/user-access.service';
import {
  DbButtonComponent,
  DbStateMessageComponent,
} from '@general-components';
import { FormModalComponent } from '../../../components/form-modal/form-modal.component';
import { extractApiErrorMessage } from '../../../shared/utils/api-error';
import { PERMISSION_ACTION_LABELS } from './user-access.util';

@Component({
  selector: 'app-roles-admin-page',
  standalone: true,
  imports: [
    FormsModule,
    DbButtonComponent,
    DbStateMessageComponent,
    FormModalComponent,
  ],
  templateUrl: './roles-admin-page.component.html',
  styleUrl: './user-access-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RolesAdminPageComponent implements OnInit {
  private readonly userAccess = inject(UserAccessService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly workActions = WORK_PERMISSION_ACTIONS;
  readonly adminActions = ADMIN_PERMISSION_ACTIONS;
  readonly actionLabels = PERMISSION_ACTION_LABELS;

  roles: AppRole[] = [];
  areas: WorkArea[] = [];
  loading = true;
  saving = false;
  error = '';
  modalOpen = false;
  editing: AppRole | null = null;

  form = {
    name: '',
    description: '',
    permissions: [] as RolePermissionEntry[],
  };

  ngOnInit(): void {
    this.reload();
  }

  permissionCount(role: AppRole): number {
    return role.permissions.length;
  }

  openCreate(): void {
    this.editing = null;
    this.form = {
      name: '',
      description: '',
      permissions: [],
    };
    this.error = '';
    this.modalOpen = true;
    this.cdr.markForCheck();
  }

  openEdit(role: AppRole): void {
    this.editing = role;
    this.form = {
      name: role.name,
      description: role.description ?? '',
      permissions: role.permissions.map((permission) => ({ ...permission })),
    };
    this.error = '';
    this.modalOpen = true;
    this.cdr.markForCheck();
  }

  closeModal(): void {
    if (this.saving) return;
    this.modalOpen = false;
    this.cdr.markForCheck();
  }

  hasWorkPermission(areaId: string, action: PermissionAction): boolean {
    return this.form.permissions.some(
      (permission) =>
        permission.action === action && permission.areaId === areaId,
    );
  }

  hasAdminPermission(action: PermissionAction): boolean {
    return this.form.permissions.some(
      (permission) => permission.action === action && permission.areaId == null,
    );
  }

  toggleWorkPermission(
    areaId: string,
    action: PermissionAction,
    checked: boolean,
  ): void {
    this.form.permissions = this.form.permissions.filter(
      (permission) =>
        !(permission.action === action && permission.areaId === areaId),
    );
    if (checked) {
      this.form.permissions.push({ action, areaId });
    }
    this.cdr.markForCheck();
  }

  toggleAdminPermission(action: PermissionAction, checked: boolean): void {
    this.form.permissions = this.form.permissions.filter(
      (permission) =>
        !(permission.action === action && permission.areaId == null),
    );
    if (checked) {
      this.form.permissions.push({ action, areaId: null });
    }
    this.cdr.markForCheck();
  }

  save(): void {
    this.saving = true;
    this.error = '';
    this.cdr.markForCheck();

    const payload = {
      name: this.form.name.trim(),
      description: this.form.description.trim() || undefined,
      permissions: this.form.permissions,
    };

    const request$ = this.editing
      ? this.userAccess.updateRole(this.editing.id, payload)
      : this.userAccess.createRole(payload);

    request$.subscribe({
      next: (saved) => {
        this.roles = this.editing
          ? this.roles.map((role) => (role.id === saved.id ? saved : role))
          : [...this.roles, saved];
        this.saving = false;
        this.modalOpen = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error = extractApiErrorMessage(err, 'No se pudo guardar el rol');
        this.saving = false;
        this.cdr.markForCheck();
      },
    });
  }

  deleteRole(role: AppRole): void {
    if (role.isSystem) return;
    if (!confirm(`¿Eliminar el rol "${role.name}"?`)) return;

    this.userAccess.deleteRole(role.id).subscribe({
      next: () => {
        this.roles = this.roles.filter((item) => item.id !== role.id);
        this.cdr.markForCheck();
      },
      error: (err) => {
        alert(extractApiErrorMessage(err, 'No se pudo eliminar el rol'));
      },
    });
  }

  private reload(): void {
    this.loading = true;
    this.cdr.markForCheck();

    this.userAccess.listRoles().subscribe({
      next: (roles) => {
        this.roles = roles;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loading = false;
        this.error = extractApiErrorMessage(err, 'No se pudieron cargar roles');
        this.cdr.markForCheck();
      },
    });

    this.userAccess.listWorkAreas().subscribe({
      next: (areas) => {
        this.areas = areas.filter((area) => area.active);
        this.cdr.markForCheck();
      },
    });
  }
}
