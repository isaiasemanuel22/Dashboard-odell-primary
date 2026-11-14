import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
  DestroyRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FdmFilamentLine,
  FilamentType,
  GeneralSettings,
} from '../../../../../core/models';
import { Store } from '@ngrx/store';
import { selectSupplies } from '../../../../../store/supplies/supplies.selectors';
import { SettingsFacade } from '../../../../../store/settings/settings.facade';
import { averageFilamentLinesPricePerKg } from '../../../../../shared/utils/cost-material.util';
import { normalizePurgeGrams } from '../../../../../shared/utils/fdm.helpers';
import { DbInputComponent } from '@dashboard-form';
import { CurrencyArsPipe } from '../../../../../shared/pipes/labels.pipe';

@Component({
  selector: 'app-product-form-ams-purge-row',
  standalone: true,
  imports: [FormsModule, DbInputComponent, CurrencyArsPipe],
  templateUrl: './product-form-ams-purge-row.component.html',
  styleUrl: './product-form-ams-purge-row.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductFormAmsPurgeRowComponent implements OnChanges {
  private readonly settingsFacade = inject(SettingsFacade);
  private readonly store = inject(Store);
  private readonly supplies = this.store.selectSignal(selectSupplies);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private settings: GeneralSettings | null = null;

  @Input() filaments: FdmFilamentLine[] = [];
  @Input() filamentType: FilamentType = FilamentType.PLA;
  @Input() purgeGrams: number | null = null;
  @Input() colorChanges: number | null = null;
  @Input() from3mf = false;
  @Output() readonly purgeGramsChange = new EventEmitter<number | null>();

  gramsDisplay = 0;

  constructor() {
    this.settingsFacade
      .watchUntilDestroyed(this.destroyRef)
      .subscribe((settings) => {
        this.settings = settings;
        this.cdr.markForCheck();
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['purgeGrams']) {
      this.gramsDisplay = Math.max(0, Number(this.purgeGrams) || 0);
    }
  }

  get visible(): boolean {
    const rows = this.filaments.filter((line) => !!line.filamentType);
    const purge = Math.max(0, Number(this.purgeGrams) || 0);
    return rows.length >= 2 || purge > 0;
  }

  get subtitle(): string {
    if (this.colorChanges != null && this.colorChanges >= 0) {
      const n = this.colorChanges;
      const noun = n === 1 ? 'cambio' : 'cambios';
      return `${n} ${noun} de color · lo descarta la A1 al cambiar`;
    }
    return 'Gramos que se descartan al cambiar de color';
  }

  get pricePerKg(): number | null {
    if (!this.settings) return null;
    return averageFilamentLinesPricePerKg(
      this.filaments,
      this.settings,
      this.filamentType,
      this.supplies(),
    );
  }

  get purgeCost(): number {
    const perKg = this.pricePerKg;
    if (perKg == null) return 0;
    return (this.gramsDisplay / 1000) * perKg;
  }

  onGramsChange(raw: number | string): void {
    const next = normalizePurgeGrams(Number(raw));
    this.gramsDisplay = next ?? 0;
    this.purgeGramsChange.emit(next);
    this.cdr.markForCheck();
  }
}
