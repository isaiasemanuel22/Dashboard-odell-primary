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
import {
  GeneralSettings,
  OrderLineDraft,
  Product,
} from '../../core/models';
import { DbInputComponent } from '../dashboard-form/db-input/db-input.component';
import { CurrencyArsPipe } from '../../shared/pipes/labels.pipe';
import { SettingsFacade } from '../../store/settings/settings.facade';
import {
  formatOrderQuoteMoney,
  formatOrderQuoteNumber,
  isOrderQuoteCatalogLocked,
} from '../order-quote-composition.util';

@Component({
  selector: 'app-order-quote-labor',
  standalone: true,
  imports: [FormsModule, DbInputComponent, CurrencyArsPipe],
  templateUrl: './order-quote-labor.component.html',
  styleUrl: './order-quote-labor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderQuoteLaborComponent implements OnInit {
  private readonly settingsFacade = inject(SettingsFacade);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  @Input({ required: true }) line!: OrderLineDraft;
  @Input() product: Product | null = null;
  @Input({ required: true }) lineIndex!: number;
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

  get laborSummary(): string {
    const hours = Number(this.line.workTimeHours) || 0;
    const rate = Number(this.generalSettings?.laborCostPerHour) || 0;
    const base = `${formatOrderQuoteNumber(hours)} h × ${formatOrderQuoteMoney(rate)}/h`;
    const note = this.line.laborNote?.trim();
    return note ? `${base} · ${note}` : base;
  }

  /** Misma fórmula en FDM, resina y estampado: horas × tarifa de Ajustes. */
  get laborCost(): number {
    const hours = Number(this.line.workTimeHours) || 0;
    const rate = Number(this.generalSettings?.laborCostPerHour) || 0;
    return Math.round(hours * rate);
  }

  onWorkHoursChange(raw: number | string): void {
    this.line.workTimeHours = Math.max(0, Number(raw) || 0);
    this.changed.emit();
    this.cdr.markForCheck();
  }

  onLaborNoteChange(): void {
    this.changed.emit();
    this.cdr.markForCheck();
  }
}
