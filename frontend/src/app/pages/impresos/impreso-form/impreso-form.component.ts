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
import { FormModalComponent } from '@general-components';
import { CurrencyArsPipe } from '../../../shared/pipes/labels.pipe';
import {
  formatPrintDimensionsCm,
  hasValidPrintSize,
} from '../../../shared/utils/estampado.helpers';
import {
  calculatePaperCostFromPricePerSqm,
  paperReferenceKey,
  pricePerSqmFromReferenceSheet,
} from '../../../shared/utils/paper-cost.util';

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
  lengthCm = 0;
  settings: GeneralSettings | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['impreso']) {
      this.resetForm();
    }
  }

  get estimatedCost(): number {
    if (
      !this.settings ||
      !hasValidPrintSize(this.widthCm, this.lengthCm, 0)
    ) {
      return 0;
    }
    const pricePerSqm =
      this.settings.paperPricesPerSqm[paperReferenceKey(this.paperType)];
    return calculatePaperCostFromPricePerSqm(
      pricePerSqm,
      this.widthCm,
      this.lengthCm,
    );
  }

  get dimensionsLabel(): string {
    return formatPrintDimensionsCm(this.widthCm, this.lengthCm);
  }

  onDimensionsChange(): void {
    // fuerza recálculo del getter estimatedCost
  }

  onSubmit(): void {
    this.save.emit({
      name: this.name.trim(),
      paperType: this.paperType,
      widthCm: Number(this.widthCm),
      lengthCm: Number(this.lengthCm),
      heightCm: 0,
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
      this.lengthCm =
        this.impreso.lengthCm && this.impreso.lengthCm > 0
          ? this.impreso.lengthCm
          : this.impreso.heightCm;
    } else {
      this.name = '';
      this.paperType = PaperType.DTF;
      this.widthCm = 0;
      this.lengthCm = 0;
    }
  }

  private getPricePerSqm(type: PaperType): number {
    if (!this.settings) return 0;
    return this.settings.paperPricesPerSqm[paperReferenceKey(type)];
  }
}
