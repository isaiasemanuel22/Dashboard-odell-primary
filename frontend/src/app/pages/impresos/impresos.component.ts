import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ImpresoWithCost, PaperType, CreateImpresoPayload } from '../../core/models';
import { ImpresosService } from '../../core/services/impresos.service';
import { PAPER_TYPE_LABELS } from '../../shared/constants/labels';
import { formatPrintDimensionsCm } from '../../shared/utils/estampado.helpers';
import { ImpresoFormComponent } from './impreso-form/impreso-form.component';
import {
  DB_DATA_TABLE,
  OdlActionEvent,
  OdlColumn,
  OdlRowAction,
} from '../../components/db-data-table';

type PaperFilter = PaperType | 'all';

@Component({
  selector: 'app-impresos',
  standalone: true,
  imports: [
    FormsModule,
    ImpresoFormComponent,
    ...DB_DATA_TABLE,
  ],
  templateUrl: './impresos.component.html',
  styleUrl: './impresos.component.scss',
})
export class ImpresosComponent implements OnInit {
  private readonly impresosService = inject(ImpresosService);

  impresos: ImpresoWithCost[] = [];
  loading = true;
  search = '';
  paperFilter: PaperFilter = 'all';

  showForm = false;
  editing: ImpresoWithCost | null = null;
  formLoading = false;
  formError = '';

  readonly typeFilters: { value: PaperFilter; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: PaperType.DTF, label: 'DTF' },
    { value: PaperType.DTF_UV, label: 'DTF UV' },
    { value: PaperType.SUBLIMACION, label: 'Sublimación' },
  ];

  readonly actions: OdlRowAction<ImpresoWithCost>[] = [
    { id: 'editar', label: 'Editar' },
    { id: 'eliminar', label: 'Eliminar', danger: true },
  ];

  readonly columns: OdlColumn<ImpresoWithCost>[] = [
    { key: 'name', header: 'Nombre', type: 'primary' },
    { key: 'paperType', header: 'Tipo de papel', value: (item) => PAPER_TYPE_LABELS[item.paperType] },
    { key: 'size', header: 'Tamaño', value: (item) => this.formatDimensions(item) },
    { key: 'areaSqm', header: 'Área (m²)', type: 'number' },
    { key: 'paperCost', header: 'Costo papel', type: 'money' },
  ];

  onAction(event: OdlActionEvent<ImpresoWithCost>): void {
    if (event.actionId === 'editar') this.openEdit(event.row);
    if (event.actionId === 'eliminar') this.deleteImpreso(event.row);
  }

  ngOnInit(): void {
    this.loadImpresos();
  }

  get filteredImpresos(): ImpresoWithCost[] {
    return this.impresos.filter((item) => {
      const matchesSearch =
        !this.search ||
        item.name.toLowerCase().includes(this.search.toLowerCase());
      const matchesType =
        this.paperFilter === 'all' || item.paperType === this.paperFilter;
      return matchesSearch && matchesType;
    });
  }

  loadImpresos(): void {
    this.loading = true;
    this.impresosService.getImpresos().subscribe({
      next: (items) => {
        this.impresos = items;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  openCreate(): void {
    this.editing = null;
    this.formError = '';
    this.showForm = true;
  }

  openEdit(item: ImpresoWithCost): void {
    this.editing = item;
    this.formError = '';
    this.showForm = true;
  }

  closeForm(): void {
    this.showForm = false;
    this.editing = null;
    this.formError = '';
  }

  onSave(payload: Parameters<ImpresosComponent['saveImpreso']>[0]): void {
    this.saveImpreso(payload);
  }

  saveImpreso(payload: CreateImpresoPayload): void {
    this.formLoading = true;
    this.formError = '';

    const request$ = this.editing
      ? this.impresosService.updateImpreso(this.editing.id, payload)
      : this.impresosService.createImpreso(payload);

    request$.subscribe({
      next: () => {
        this.formLoading = false;
        this.closeForm();
        this.loadImpresos();
      },
      error: (err) => {
        this.formLoading = false;
        this.formError = err.error?.message ?? 'Error al guardar';
      },
    });
  }

  deleteImpreso(item: ImpresoWithCost): void {
    if (!confirm(`¿Eliminar "${item.name}"?`)) return;
    this.impresosService.deleteImpreso(item.id).subscribe(() => {
      this.loadImpresos();
    });
  }

  formatDimensions(item: ImpresoWithCost): string {
    return formatPrintDimensionsCm(
      item.widthCm,
      item.lengthCm && item.lengthCm > 0 ? item.lengthCm : item.heightCm,
    );
  }
}
