import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { SupplyPriceChangeRow } from '../../../core/models';
import {
  DB_DATA_TABLE,
  OdlColumn,
} from '@general-components';

@Component({
  selector: 'app-products-supply-price-changes',
  standalone: true,
  imports: [...DB_DATA_TABLE],
  templateUrl: './products-supply-price-changes.component.html',
  styleUrl: './products-supply-price-changes.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductsSupplyPriceChangesComponent {
  @Input() rows: SupplyPriceChangeRow[] = [];
  @Input() loading = false;

  readonly columns: OdlColumn<SupplyPriceChangeRow>[] = [
    { key: 'name', header: 'Insumo', type: 'primary' },
    {
      key: 'priceBefore',
      header: 'Hace 3 meses',
      align: 'end',
      value: (row) => this.formatUnitPrice(row.priceBefore, row.unit),
    },
    {
      key: 'priceNow',
      header: 'Hoy',
      align: 'end',
      value: (row) => this.formatUnitPrice(row.priceNow, row.unit),
    },
    {
      key: 'variationPercent',
      header: 'Variación',
      align: 'end',
      value: (row) => this.formatVariation(row.variationPercent),
    },
    {
      key: 'affectedProducts',
      header: 'Productos afectados',
      type: 'number',
      align: 'end',
    },
  ];

  formatUnitPrice(value: number, unit: string): string {
    const money = new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(Number(value) || 0);
    const suffix = unit?.trim();
    return suffix ? `${money}/${suffix}` : money;
  }

  formatVariation(value: number): string {
    const rounded = Math.round(Number(value) || 0);
    if (rounded > 0) return `+${rounded}%`;
    return `${rounded}%`;
  }

  variationTone(value: number): 'up' | 'flat' | 'down' {
    const n = Number(value) || 0;
    if (n > 0) return 'up';
    if (n < 0) return 'down';
    return 'flat';
  }
}
