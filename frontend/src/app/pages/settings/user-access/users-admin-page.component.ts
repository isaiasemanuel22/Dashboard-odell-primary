import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AppRole, AppUser } from '../../../core/models';
import { UserAccessService } from '../../../core/services/user-access.service';
import {
  DbButtonComponent,
  DbStateMessageComponent,
} from '@general-components';
import { FormModalComponent } from '../../../components/form-modal/form-modal.component';
import { extractApiErrorMessage } from '../../../shared/utils/api-error';

@Component({
  selector: 'app-users-admin-page',
  standalone: true,
  imports: [
    FormsModule,
    DbButtonComponent,
    DbStateMessageComponent,
    FormModalComponent,
  ],
  templateUrl: './users-admin-page.component.html',
  styleUrl: './user-access-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersAdminPageComponent implements OnInit {
  private readonly userAccess = inject(UserAccessService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  users: AppUser[] = [];
  roles: AppRole[] = [];
  loading = true;
  saving = false;
  error = '';
  modalOpen = false;
  editing: AppUser | null = null;

  form = {
    email: '',
    displayName: '',
    firebaseUid: '',
    active: true,
    roleIds: [] as string[],
  };

  ngOnInit(): void {
    this.reload();
  }

  roleName(roleId: string): string {
    return this.roles.find((role) => role.id === roleId)?.name ?? roleId;
  }

  openCreate(): void {
    this.editing = null;
    this.form = {
      email: '',
      displayName: '',
      firebaseUid: '',
      active: true,
      roleIds: [],
    };
    this.error = '';
    this.modalOpen = true;
    this.cdr.markForCheck();
  }

  openEdit(user: AppUser): void {
    this.editing = user;
    this.form = {
      email: user.email,
      displayName: user.displayName,
      firebaseUid: user.firebaseUid ?? '',
      active: user.active,
      roleIds: [...user.roleIds],
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

  toggleRole(roleId: string, checked: boolean): void {
    if (checked) {
      if (!this.form.roleIds.includes(roleId)) {
        this.form.roleIds = [...this.form.roleIds, roleId];
      }
      return;
    }
    this.form.roleIds = this.form.roleIds.filter((id) => id !== roleId);
  }

  save(): void {
    this.saving = true;
    this.error = '';
    this.cdr.markForCheck();

    const payload = {
      email: this.form.email.trim(),
      displayName: this.form.displayName.trim(),
      firebaseUid: this.form.firebaseUid.trim() || undefined,
      active: this.form.active,
      roleIds: [...this.form.roleIds],
    };

    const request$ = this.editing
      ? this.userAccess.updateUser(this.editing.id, {
          ...payload,
          firebaseUid: this.form.firebaseUid.trim() || null,
        })
      : this.userAccess.createUser(payload);

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (saved) => {
        this.users = this.editing
          ? this.users.map((user) => (user.id === saved.id ? saved : user))
          : [...this.users, saved];
        this.saving = false;
        this.modalOpen = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error = extractApiErrorMessage(err, 'No se pudo guardar el usuario');
        this.saving = false;
        this.cdr.markForCheck();
      },
    });
  }

  deleteUser(user: AppUser): void {
    if (!confirm(`¿Eliminar a "${user.displayName}"?`)) return;

    this.userAccess.deleteUser(user.id).subscribe({
      next: () => {
        this.users = this.users.filter((item) => item.id !== user.id);
        this.cdr.markForCheck();
      },
      error: (err) => {
        alert(extractApiErrorMessage(err, 'No se pudo eliminar el usuario'));
      },
    });
  }

  private reload(): void {
    this.loading = true;
    this.cdr.markForCheck();

    this.userAccess.listUsers().subscribe({
      next: (users) => {
        this.users = users;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loading = false;
        this.error = extractApiErrorMessage(err, 'No se pudieron cargar usuarios');
        this.cdr.markForCheck();
      },
    });

    this.userAccess.listRoles().subscribe({
      next: (roles) => {
        this.roles = roles;
        this.cdr.markForCheck();
      },
    });
  }
}
