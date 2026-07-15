import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  DbFormComponent,
  DbFormErrorComponent,
  DbFormFooterComponent,
  DbFormGridComponent,
  DbInputComponent,
  DbSelectComponent,
  DbSelectOption,
} from '@dashboard-form';
import {
  CreateImpresoPayload,
  GeneralSettings,
  ImpresoWithCost,
  PaperType,
} from '../../../core/models';
import { SettingsService } from '../../../core/services/settings.service';
import { FormModalComponent } from '../../../shared/components/form-modal/form-modal.component';
import { CurrencyArsPipe } from '../../../shared/pipes/labels.pipe';

const PAPER_TYPE_OPTIONS: DbSelectOption[] = [
  { value: PaperType.SUBLIMACION, label: 'Sublimación' },
  { value: PaperType.DTF, label: 'DTF' },
  { value: PaperType.DTF_UV, label: 'DTF UV' },
];

@Component({
  selector: 'app-impreso-form',
  standalone: true,
  imports: [
    FormsModule,
    FormModalComponent,
    DbFormComponent,
    DbFormGridComponent,
    DbInputComponent,
    DbSelectComponent,
    DbFormErrorComponent,
    DbFormFooterComponent,
    CurrencyArsPipe,
  ],
  templateUrl: './impreso-form.component.html',
  styleUrl: './impreso-form.component.scss',
})
export class ImpresoFormComponent implements OnChanges {
  private readonly settingsService = inject(SettingsService);

  @Input() impreso: ImpresoWithCost | null = null;
  @Input() loading = false;
  @Input() error = '';
  @Output() save = new EventEmitter<CreateImpresoPayload>();
  @Output() cancel = new EventEmitter<void>();

  readonly paperTypeOptions = PAPER_TYPE_OPTIONS;

  name = '';
  paperType = PaperType.DTF;
  widthCm = 0;
  heightCm = 0;
  settings: GeneralSettings | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['impreso']) {
      this.resetForm();
    }
  }

  get estimatedCost(): number {
    if (!this.settings || this.widthCm <= 0 || this.heightCm <= 0) return 0;
    const areaSqm = (this.widthCm * this.heightCm) / 10000;
    const pricePerSqm = this.getPricePerSqm(this.paperType);
    return Math.round(areaSqm * pricePerSqm);
  }

  get dimensionsLabel(): string {
    if (this.widthCm <= 0 || this.heightCm <= 0) return '—';
    return `${this.widthCm} × ${this.heightCm} cm`;
  }

  onSubmit(): void {
    this.save.emit({
      name: this.name.trim(),
      paperType: this.paperType,
      widthCm: Number(this.widthCm),
      heightCm: Number(this.heightCm),
    });
  }

  private resetForm(): void {
    this.settingsService.getGeneralSettings().subscribe((s) => {
      this.settings = s;
    });

    if (this.impreso) {
      this.name = this.impreso.name;
      this.paperType = this.impreso.paperType;
      this.widthCm = this.impreso.widthCm;
      this.heightCm = this.impreso.heightCm;
    } else {
      this.name = '';
      this.paperType = PaperType.DTF;
      this.widthCm = 0;
      this.heightCm = 0;
    }
  }

  private getPricePerSqm(type: PaperType): number {
    if (!this.settings) return 0;
    const prices = this.settings.paperPricesPerSqm;
    switch (type) {
      case PaperType.SUBLIMACION:
        return prices.sublimacion;
      case PaperType.DTF:
        return prices.dtf;
      case PaperType.DTF_UV:
        return prices.dtfUv;
      default:
        return 0;
    }
  }
}
