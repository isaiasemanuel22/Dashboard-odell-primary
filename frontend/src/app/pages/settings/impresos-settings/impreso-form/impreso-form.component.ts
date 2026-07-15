import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ChangeDetectorRef,
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
  DbButtonComponent,
  DbSelectOption,
} from '@general-components';
import {
  CreateImpresoPayload,
  ImpresoWithCost,
  PaperType,
} from '../../../../core/models';
import { ImpresosService } from '../../../../core/services/impresos.service';
import {
  formatPrintDimensionsCm,
  hasValidPrintSize,
} from '../../../../shared/utils/estampado.helpers';
import { CurrencyArsPipe } from '../../../../shared/pipes/labels.pipe';

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
    DbFormComponent,
    DbInputComponent,
    DbSelectComponent,
    DbFormGridComponent,
    DbFormErrorComponent,
    DbFormFooterComponent,
    DbButtonComponent,
    CurrencyArsPipe,
  ],
  templateUrl: './impreso-form.component.html',
  styleUrl: './impreso-form.component.scss',
})
export class ImpresoFormComponent implements OnChanges, OnDestroy {
  private readonly impresosService = inject(ImpresosService);
  private readonly cdr = inject(ChangeDetectorRef);

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
  heightCm = 0;
  estimatedCost = 0;

  private previewTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['impreso']) {
      this.resetForm();
    }
  }

  ngOnDestroy(): void {
    this.clearPreviewTimer();
  }

  get dimensionsLabel(): string {
    return formatPrintDimensionsCm(
      this.widthCm,
      this.lengthCm || undefined,
      this.heightCm,
    );
  }

  onDimensionsChange(): void {
    this.scheduleCostPreview();
  }

  onSubmit(): void {
    this.save.emit({
      name: this.name.trim(),
      paperType: this.paperType,
      widthCm: Number(this.widthCm),
      lengthCm:
        Number(this.lengthCm) > 0 ? Number(this.lengthCm) : undefined,
      heightCm: Number(this.heightCm),
    });
  }

  private resetForm(): void {
    if (this.impreso) {
      this.name = this.impreso.name;
      this.paperType = this.impreso.paperType;
      this.widthCm = this.impreso.widthCm;
      this.lengthCm = this.impreso.lengthCm ?? 0;
      this.heightCm = this.impreso.heightCm;
    } else {
      this.name = '';
      this.paperType = PaperType.DTF;
      this.widthCm = 0;
      this.lengthCm = 0;
      this.heightCm = 0;
    }
    this.scheduleCostPreview();
  }

  private scheduleCostPreview(): void {
    this.clearPreviewTimer();
    this.previewTimer = setTimeout(() => this.loadCostPreview(), 300);
  }

  private clearPreviewTimer(): void {
    if (this.previewTimer) {
      clearTimeout(this.previewTimer);
      this.previewTimer = null;
    }
  }

  private loadCostPreview(): void {
    if (!hasValidPrintSize(this.widthCm, this.lengthCm, this.heightCm)) {
      this.estimatedCost = 0;
      return;
    }

    this.impresosService
      .previewCost({
        paperType: this.paperType,
        widthCm: Number(this.widthCm),
        lengthCm:
          Number(this.lengthCm) > 0 ? Number(this.lengthCm) : undefined,
        heightCm: Number(this.heightCm),
      })
      .subscribe({
        next: (preview) => {
          this.estimatedCost = preview.paperCost;
          this.cdr.markForCheck();
        },
        error: () => {
          this.estimatedCost = 0;
          this.cdr.markForCheck();
        },
      });
  }
}
