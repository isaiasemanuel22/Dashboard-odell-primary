import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  GeneralSettings,
  MachineProfile,
  MachineProfileRole,
  OrderLineDraft,
  Product,
  ProductType,
} from '../../core/models';
import { DbSelectComponent } from '../dashboard-form/db-select/db-select.component';
import { DbSelectOption } from '../dashboard-form/db-select/db-select.types';
import { PressCycleListComponent } from '../dynamic-lists/press-cycle-list/press-cycle-list.component';
import { CurrencyArsPipe } from '../../shared/pipes/labels.pipe';
import {
  normalizeEstampadoPressCycles,
  totalEstampadoPressMinutes,
} from '../../shared/utils/estampado.helpers';
import { getMachineProfilesForProductType } from '../../shared/utils/machine-profile.util';
import { SettingsFacade } from '../../store/settings/settings.facade';
import {
  formatOrderQuoteNumber,
  isOrderQuoteCatalogLocked,
} from '../order-quote-composition.util';

@Component({
  selector: 'app-order-quote-estampado-press',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    DbSelectComponent,
    PressCycleListComponent,
    CurrencyArsPipe,
  ],
  templateUrl: './order-quote-estampado-press.component.html',
  styleUrl: './order-quote-estampado-press.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderQuoteEstampadoPressComponent implements OnInit {
  private readonly settingsFacade = inject(SettingsFacade);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  @Input({ required: true }) line!: OrderLineDraft;
  @Input() product: Product | null = null;
  @Input({ required: true }) lineIndex!: number;
  @Input() pressCost = 0;
  @Output() changed = new EventEmitter<void>();

  private generalSettings: GeneralSettings | null = null;

  ngOnInit(): void {
    this.settingsFacade
      .watchUntilDestroyed(this.destroyRef)
      .subscribe((settings) => {
        this.generalSettings = settings;
        this.cdr.markForCheck();
      });
  }

  get catalogLocked(): boolean {
    return isOrderQuoteCatalogLocked(this.line);
  }

  get pressProfile(): MachineProfile | undefined {
    if (!this.generalSettings) return undefined;
    return getMachineProfilesForProductType(
      this.generalSettings,
      ProductType.ESTAMPADO,
    ).find((profile) => profile.role === MachineProfileRole.PRESS);
  }

  get pressProfileOptions(): DbSelectOption[] {
    const profile = this.pressProfile;
    return profile
      ? [{ value: profile.id, label: `${profile.name} · ${profile.watts} W` }]
      : [{ value: '', label: 'Sin plancha en Ajustes' }];
  }

  get electricityCostPerKwh(): number {
    return Number(this.generalSettings?.electricityCostPerKwh) || 0;
  }

  get pressSummary(): string {
    const cycles = normalizeEstampadoPressCycles(this.line.estampadoPressCycles);
    const bajadas = cycles.reduce(
      (sum, cycle) => sum + (Number(cycle.bajadas) || 1),
      0,
    );
    const minutes = totalEstampadoPressMinutes(this.line.estampadoPressCycles);
    const profile = this.pressProfile;
    const parts = profile ? [profile.name] : [];
    parts.push(`${bajadas} ${bajadas === 1 ? 'bajada' : 'bajadas'}`);
    parts.push(`${formatOrderQuoteNumber(minutes)} min`);
    return parts.join(' · ');
  }

  onChange(): void {
    this.changed.emit();
    this.cdr.markForCheck();
  }
}
