import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { ColorConfig, Supply, SupplyCategory } from '../../core/models';
import {
  FILAMENT_TYPE_LABELS,
  RESIN_TYPE_LABELS,
  SUPPLY_CATEGORY_LABELS,
} from '../../shared/constants/labels';
import {
  resolveColorHex,
  resolveColorLabel,
  supplyRequiresColor,
} from '../../shared/utils/color.helpers';
import {
  DB_DATA_TABLE,
  OdlActionEvent,
  OdlArea,
  OdlColumn,
  OdlRowAction,
  OdlTag,
} from '../db-data-table';

const CATEGORY_AREA: Record<SupplyCategory, OdlArea> = {
  [SupplyCategory.FDM]: 'impresion3d',
  [SupplyCategory.RESINA]: 'impresion3d',
  [SupplyCategory.ESTAMPADO]: 'estampado',
  [SupplyCategory.GENERAL]: 'general',
};

@Component({
  selector: 'app-supplies-table',
  standalone: true,
  imports: [...DB_DATA_TABLE],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './supplies-table.component.html',
  styleUrl: './supplies-table.component.scss',
})
export class SuppliesTableComponent {
  @Input({ required: true }) supplies!: Supply[];
  @Input() colorCatalog: ColorConfig[] = [];
  @Output() edit = new EventEmitter<Supply>();
  @Output() delete = new EventEmitter<Supply>();

  readonly actions: OdlRowAction<Supply>[] = [
    { id: 'editar', label: 'Editar' },
    { id: 'eliminar', label: 'Eliminar', danger: true },
  ];

  readonly columns: OdlColumn<Supply>[] = [
    {
      key: 'name',
      header: 'Insumo',
      type: 'primary',
      secondary: (supply) => this.materialLine(supply) || null,
    },
    {
      key: 'category',
      header: 'Categoría',
      type: 'tags',
      tags: (supply) => [this.categoryTag(supply)],
    },
    {
      key: 'color',
      header: 'Color',
      type: 'swatch',
      value: (supply) => (this.showColor(supply) ? this.colorLabel(supply) || null : null),
      swatch: (supply) => (this.showColor(supply) ? this.colorHex(supply) ?? null : null),
    },
    {
      key: 'stock',
      header: 'Stock',
      align: 'end',
      value: (supply) => this.formatQuantity(supply),
      note: (supply) =>
        this.isLowStock(supply)
          ? { text: supply.quantity <= 0 ? 'Sin stock' : 'Reponer', tone: 'danger' }
          : null,
    },
    {
      key: 'unitPrice',
      header: 'Precio / u',
      type: 'money',
      note: (supply) => (!supply.unitPrice ? { text: 'Falta precio', tone: 'danger' } : null),
    },
    {
      key: 'estado',
      header: 'Estado',
      type: 'badge',
      badge: (supply) =>
        this.isLowStock(supply)
          ? { label: 'Stock bajo', tone: 'danger' }
          : { label: 'OK', tone: 'ok' },
    },
  ];

  onAction(event: OdlActionEvent<Supply>): void {
    if (event.actionId === 'editar') this.edit.emit(event.row);
    if (event.actionId === 'eliminar') this.delete.emit(event.row);
  }

  private isLowStock(supply: Supply): boolean {
    return supply.quantity <= supply.minStock;
  }

  private materialLine(supply: Supply): string {
    const material = supply.filamentType
      ? FILAMENT_TYPE_LABELS[supply.filamentType] ?? supply.filamentType.toUpperCase()
      : supply.resinType
        ? RESIN_TYPE_LABELS[supply.resinType] ?? supply.resinType
        : '';
    return [supply.brand, material].filter(Boolean).join(' · ');
  }

  private formatQuantity(supply: Supply): string {
    const quantity = new Intl.NumberFormat('es-AR', {
      maximumFractionDigits: 2,
    }).format(supply.quantity);
    return `${quantity} ${supply.unit}`;
  }

  private showColor(supply: Supply): boolean {
    return supplyRequiresColor(supply.category);
  }

  private colorLabel(supply: Supply): string {
    return resolveColorLabel(supply.colorId, this.colorCatalog);
  }

  private colorHex(supply: Supply): string | undefined {
    return resolveColorHex(supply.colorId, this.colorCatalog);
  }

  private categoryTag(supply: Supply): OdlTag {
    return {
      label: SUPPLY_CATEGORY_LABELS[supply.category] ?? supply.category,
      area: CATEGORY_AREA[supply.category] ?? 'general',
    };
  }
}
