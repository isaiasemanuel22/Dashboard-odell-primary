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
import { AppRole, AppUser, WorkArea } from '../../../core/models';
import { UserAccessService } from '../../../core/services/user-access.service';
import { BreakpointService } from '../../../core/services/breakpoint.service';
import {
  DbAreaChipComponent,
  DbButtonComponent,
  DbCheckboxComponent,
  DbInputComponent,
  DbStateMessageComponent,
  DB_DATA_TABLE,
  OdlActionEvent,
  OdlColumn,
  OdlRowAction,
  MobileCatalogRowComponent,
} from '@general-components';
import { FormModalComponent } from '../../../modals/form-modal/form-modal.component';
import { extractApiErrorMessage } from '../../../shared/utils/api-error';
import { UserAccessHeadComponent } from './user-access-head.component';
import { UserAccessNavComponent } from './user-access-nav.component';
import { UsersAdminFormComponent } from './users-admin-form/users-admin-form.component';
import { SettingsUsersMobileShellComponent } from './settings-users-mobile-shell.component';
import { normalizeSearchText } from '../../../shared/utils/search-text.util';

@Component({
  selector: 'app-users-admin-page',
  standalone: true,
  imports: [
    MobileCatalogRowComponent,
    FormsModule,
    DbAreaChipComponent,
    DbButtonComponent,
    DbStateMessageComponent,
    FormModalComponent,
    UserAccessHeadComponent,
    UserAccessNavComponent,
    UsersAdminFormComponent,
    SettingsUsersMobileShellComponent,
    ...DB_DATA_TABLE,
  ],
  templateUrl: './users-admin-page.component.html',
  styleUrl: './user-access-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersAdminPageComponent implements OnInit {
  private readonly userAccess = inject(UserAccessService);
  private readonly breakpoint = inject(BreakpointService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  readonly isMobile = this.breakpoint.isMobile;

  users: AppUser[] = [];

  readonly userActions: OdlRowAction<AppUser>[] = [
    { id: 'editar', label: 'Editar' },
    { id: 'eliminar', label: 'Eliminar', danger: true },
  ];

  readonly userColumns: OdlColumn<AppUser>[] = [
    {
      key: 'displayName',
      header: 'Usuario',
      type: 'avatar',
      secondary: (user) => user.email,
    },
    { key: 'roles', header: 'Roles' },
    { key: 'areas', header: 'Áreas' },
    {
      key: 'active',
      header: 'Estado',
      type: 'badge',
      badge: (user) => ({
        label: user.active ? 'Activo' : 'Inactivo',
        tone: user.active ? 'ok' : 'neutral',
      }),
    },
  ];

  onUserAction(event: OdlActionEvent<AppUser>): void {
    if (event.actionId === 'editar') this.openEdit(event.row);
    if (event.actionId === 'eliminar') this.deleteUser(event.row);
  }
  roles: AppRole[] = [];
  areas: WorkArea[] = [];
  loading = true;
  saving = false;
  error = '';
  modalOpen = false;
  editing: AppUser | null = null;
  search = '';
  openMenuId: string | null = null;

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

  get activeUserLabel(): string {
    const count = this.users.filter((user) => user.active).length;
    const noun = count === 1 ? 'usuario activo' : 'usuarios activos';
    return `${count} ${noun}`;
  }

  get visibleUsers(): AppUser[] {
    const query = normalizeSearchText(this.search);
    if (!query) return this.users;
    return this.users.filter(
      (user) =>
        normalizeSearchText(user.displayName).includes(query) ||
        normalizeSearchText(user.email).includes(query),
    );
  }

  initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }

  isAdminUser(user: AppUser): boolean {
    return user.roleIds.some((roleId) => {
      const role = this.roles.find((item) => item.id === roleId);
      return role?.name?.toLowerCase().includes('admin') ?? false;
    });
  }

  userMobileSubtitle(user: AppUser): string {
    const roleNames = user.roleIds
      .map((roleId) => this.roleName(roleId))
      .filter(Boolean);
    const areas = this.userAreas(user)
      .map((area) => area.name)
      .filter(Boolean);
    if (this.isAdminUser(user)) {
      return user.email;
    }
    const rolePart = roleNames.join(', ') || 'Sin rol';
    if (areas.length) {
      return `${rolePart} · ${areas.join(' y ')}`;
    }
    return `${rolePart} · ${user.email}`;
  }

  userAreas(user: AppUser): WorkArea[] {
    const areaIds = new Set<string>();
    for (const roleId of user.roleIds) {
      const role = this.roles.find((item) => item.id === roleId);
      for (const permission of role?.permissions ?? []) {
        if (permission.areaId) areaIds.add(permission.areaId);
      }
    }
    return this.areas
      .filter((area) => areaIds.has(area.id))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'es'));
  }

  toggleMenu(id: string): void {
    this.openMenuId = this.openMenuId === id ? null : id;
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

    this.userAccess.listWorkAreas().subscribe({
      next: (areas) => {
        this.areas = areas;
        this.cdr.markForCheck();
      },
    });
  }
}
