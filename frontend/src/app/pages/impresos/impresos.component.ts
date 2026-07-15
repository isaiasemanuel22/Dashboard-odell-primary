import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ImpresoWithCost, PaperType } from '../../core/models';
import { ImpresosService } from '../../core/services/impresos.service';
import {
  CurrencyArsPipe,
  PaperTypeLabelPipe,
} from '../../shared/pipes/labels.pipe';
import { ImpresoFormComponent } from './impreso-form/impreso-form.component';

type PaperFilter = PaperType | 'all';

@Component({
  selector: 'app-impresos',
  standalone: true,
  imports: [
    FormsModule,
    CurrencyArsPipe,
    PaperTypeLabelPipe,
    ImpresoFormComponent,
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

  saveImpreso(payload: {
    name: string;
    paperType: PaperType;
    widthCm: number;
    heightCm: number;
  }): void {
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
    return `${item.widthCm} × ${item.heightCm} cm`;
  }
}
