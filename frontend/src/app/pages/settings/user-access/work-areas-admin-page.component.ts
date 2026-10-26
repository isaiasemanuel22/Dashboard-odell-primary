import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WorkArea } from '../../../core/models';
import { UserAccessService } from '../../../core/services/user-access.service';
import {
  DbButtonComponent,
  DbCheckboxComponent,
  DbInputComponent,
  DbStateMessageComponent,
  DB_DATA_TABLE,
  OdlActionEvent,
  OdlColumn,
  OdlRowAction,
} from '@general-components';
import { FormModalComponent } from '../../../components/form-modal/form-modal.component';
import { extractApiErrorMessage } from '../../../shared/utils/api-error';
import { UserAccessHeadComponent } from './user-access-head.component';
import { UserAccessNavComponent } from './user-access-nav.component';

@Component({
  selector: 'app-work-areas-admin-page',
  standalone: true,
  imports: [
    FormsModule,
    DbButtonComponent,
    DbCheckboxComponent,
    DbInputComponent,
    DbStateMessageComponent,
    FormModalComponent,
    UserAccessHeadComponent,
    UserAccessNavComponent,
    ...DB_DATA_TABLE,
  ],
  templateUrl: './work-areas-admin-page.component.html',
  styleUrl: './user-access-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkAreasAdminPageComponent implements OnInit {
  private readonly userAccess = inject(UserAccessService);
  private readonly cdr = inject(ChangeDetectorRef);

  areas: WorkArea[] = [];

  readonly areaActions: OdlRowAction<WorkArea>[] = [
    { id: 'editar', label: 'Editar' },
    { id: 'eliminar', label: 'Eliminar', danger: true },
  ];

  readonly areaColumns: OdlColumn<WorkArea>[] = [
    { key: 'name', header: 'Nombre', type: 'primary' },
    { key: 'slug', header: 'Identificador' },
    { key: 'sortOrder', header: 'Orden', type: 'number' },
    {
      key: 'active',
      header: 'Estado',
      type: 'badge',
      badge: (area) => ({
        label: area.active ? 'Activa' : 'Inactiva',
        tone: area.active ? 'ok' : 'neutral',
      }),
    },
  ];

  onAreaAction(event: OdlActionEvent<WorkArea>): void {
    if (event.actionId === 'editar') this.openEdit(event.row);
    if (event.actionId === 'eliminar') this.deleteArea(event.row);
  }
  loading = true;
  saving = false;
  error = '';
  modalOpen = false;
  editing: WorkArea | null = null;

  form = {
    name: '',
    slug: '',
    active: true,
    sortOrder: 0,
  };

  ngOnInit(): void {
    this.reload();
  }

  openCreate(): void {
    this.editing = null;
    this.form = {
      name: '',
      slug: '',
      active: true,
      sortOrder: (this.areas.at(-1)?.sortOrder ?? 0) + 1,
    };
    this.error = '';
    this.modalOpen = true;
    this.cdr.markForCheck();
  }

  openEdit(area: WorkArea): void {
    this.editing = area;
    this.form = {
      name: area.name,
      slug: area.slug,
      active: area.active,
      sortOrder: area.sortOrder,
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

  save(): void {
    this.saving = true;
    this.error = '';
    this.cdr.markForCheck();

    const payload = {
      name: this.form.name.trim(),
      slug: this.form.slug.trim() || undefined,
      active: this.form.active,
      sortOrder: Number(this.form.sortOrder) || 0,
    };

    const request$ = this.editing
      ? this.userAccess.updateWorkArea(this.editing.id, payload)
      : this.userAccess.createWorkArea(payload);

    request$.subscribe({
      next: (saved) => {
        this.areas = this.editing
          ? this.areas.map((area) => (area.id === saved.id ? saved : area))
          : [...this.areas, saved].sort(
              (left, right) => left.sortOrder - right.sortOrder,
            );
        this.saving = false;
        this.modalOpen = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error = extractApiErrorMessage(err, 'No se pudo guardar el área');
        this.saving = false;
        this.cdr.markForCheck();
      },
    });
  }

  deleteArea(area: WorkArea): void {
    if (!confirm(`¿Eliminar el área "${area.name}"?`)) return;

    this.userAccess.deleteWorkArea(area.id).subscribe({
      next: () => {
        this.areas = this.areas.filter((item) => item.id !== area.id);
        this.cdr.markForCheck();
      },
      error: (err) => {
        alert(extractApiErrorMessage(err, 'No se pudo eliminar el área'));
      },
    });
  }

  private reload(): void {
    this.loading = true;
    this.cdr.markForCheck();

    this.userAccess.listWorkAreas().subscribe({
      next: (areas) => {
        this.areas = areas;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loading = false;
        this.error = extractApiErrorMessage(err, 'No se pudieron cargar áreas');
        this.cdr.markForCheck();
      },
    });
  }
}
