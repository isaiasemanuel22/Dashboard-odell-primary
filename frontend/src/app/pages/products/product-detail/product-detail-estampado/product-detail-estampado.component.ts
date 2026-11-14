import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  Input,
  OnInit,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import {
  ColorConfig,
  GeneralSettings,
  ImpresoWithCost,
  MachineProfileRole,
  ProductEstampado,
  ProductType,
} from '../../../../core/models';
import { ImpresosService } from '../../../../core/services/impresos.service';
import { PaperTypeLabelPipe } from '../../../../shared/pipes/labels.pipe';
import {
  resolveColorHex,
  resolveColorLabel,
} from '../../../../shared/utils/color.helpers';
import {
  formatPrintDimensionsCm,
  normalizeEstampadoPressCycles,
  normalizeEstampadoPrints,
  normalizeEstampadoSupplies,
  printQuantity,
  totalEstampadoPressMinutes,
} from '../../../../shared/utils/estampado.helpers';
import { getMachineProfilesForProductType } from '../../../../shared/utils/machine-profile.util';
import { SuppliesFacade } from '../../../../store/supplies/supplies.facade';
import { selectSupplies } from '../../../../store/supplies/supplies.selectors';

interface PrintRow {
  name: string;
  paperType: ImpresoWithCost['paperType'];
  size: string;
  quantity: number;
}

interface SupplyRow {
  name: string;
  quantity: number;
  unit: string;
  colorId?: string;
}

interface CycleRow {
  label: string;
  minutes: number;
  bajadas: number;
}

@Component({
  selector: 'app-product-detail-estampado',
  standalone: true,
  imports: [PaperTypeLabelPipe],
  templateUrl: './product-detail-estampado.component.html',
  styleUrl: './product-detail-estampado.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductDetailEstampadoComponent implements OnInit {
  @Input({ required: true }) product!: ProductEstampado;
  @Input() colorCatalog: ColorConfig[] = [];
  @Input() generalSettings: GeneralSettings | null = null;

  private readonly impresosService = inject(ImpresosService);
  private readonly suppliesFacade = inject(SuppliesFacade);
  private readonly store = inject(Store);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly suppliesSignal = this.store.selectSignal(selectSupplies);

  impresos: ImpresoWithCost[] = [];

  ngOnInit(): void {
    this.suppliesFacade.load(false);
    this.impresosService
      .getImpresos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((items) => {
        this.impresos = items;
        this.cdr.markForCheck();
      });
  }

  get printRows(): PrintRow[] {
    return normalizeEstampadoPrints(this.product.prints).map((print) => {
      const impreso = print.impresoId
        ? this.impresos.find((item) => item.id === print.impresoId)
        : undefined;
      return {
        name:
          impreso?.name ??
          print.label?.trim() ??
          (print.impresoId ? 'Impreso (ya no está en el catálogo)' : 'Impreso'),
        paperType: impreso?.paperType ?? print.paperType,
        size: formatPrintDimensionsCm(
          impreso?.widthCm ?? print.widthCm ?? 0,
          impreso?.lengthCm ?? print.lengthCm,
          impreso?.heightCm ?? print.heightCm,
        ),
        quantity: printQuantity(print),
      };
    });
  }

  get cycleRows(): CycleRow[] {
    return normalizeEstampadoPressCycles(this.product.pressCycles).map(
      (cycle, index) => ({
        label: cycle.label?.trim() || `Bajada ${index + 1}`,
        minutes: cycle.pressMinutes,
        bajadas: cycle.bajadas,
      }),
    );
  }

  get totalMinutes(): number {
    return totalEstampadoPressMinutes(this.product.pressCycles);
  }

  get pressName(): string | null {
    if (!this.generalSettings) return null;
    return (
      getMachineProfilesForProductType(
        this.generalSettings,
        ProductType.ESTAMPADO,
      ).find((p) => p.role === MachineProfileRole.PRESS)?.name ?? null
    );
  }

  get supplyRows(): SupplyRow[] {
    const supplies = this.suppliesSignal();
    return normalizeEstampadoSupplies(this.product.supplies).map((line) => {
      const supply = supplies.find((item) => item.id === line.supplyId);
      return {
        name: supply?.name ?? 'Insumo',
        quantity: line.quantity,
        unit: supply?.unit ?? '',
        colorId: line.colorId,
      };
    });
  }

  get workHours(): number {
    return Number(this.product.workTimeHours) || 0;
  }

  colorLabel(colorId?: string): string {
    return resolveColorLabel(colorId, this.colorCatalog);
  }

  colorHex(colorId?: string): string | undefined {
    return resolveColorHex(colorId, this.colorCatalog);
  }
}
