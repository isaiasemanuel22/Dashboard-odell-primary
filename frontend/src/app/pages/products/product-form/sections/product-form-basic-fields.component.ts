import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProductType } from '../../../../core/models';
import {
  DbCheckboxComponent,
  DbFormGridComponent,
  DbFormGridFullComponent,
  DbInputComponent,
  DbSelectComponent,
  DbSelectOption,
} from '@general-components';

export interface ProductFormBasicFieldsValue {
  type: ProductType;
  name: string;
  published: boolean;
  includesPieces: boolean;
  finishedStock: number;
}

@Component({
  selector: 'app-product-form-basic-fields',
  standalone: true,
  imports: [
    FormsModule,
    DbFormGridComponent,
    DbSelectComponent,
    DbInputComponent,
    DbCheckboxComponent,
    DbFormGridFullComponent,
  ],
  templateUrl: './product-form-basic-fields.component.html',
  styleUrl: '../product-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductFormBasicFieldsComponent {
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) productTypeOptions!: DbSelectOption[];
  @Output() readonly valueChange =
    new EventEmitter<ProductFormBasicFieldsValue>();

  type: ProductType = ProductType.FDM;
  name = '';
  published = true;
  includesPieces = false;
  finishedStock = 0;

  private loaded = false;
  private lastEmitted: ProductFormBasicFieldsValue | null = null;

  @Input() set value(value: ProductFormBasicFieldsValue | null) {
    if (!value) {
      return;
    }

    if (!this.isSameValue(value, this.currentValue())) {
      this.type = value.type;
      this.name = value.name;
      this.published = value.published;
      this.includesPieces = value.includesPieces;
      this.finishedStock = value.finishedStock;
    }

    this.lastEmitted = { ...value };
    this.loaded = true;
    this.cdr.markForCheck();
  }

  get showIncludesPiecesCheckbox(): boolean {
    return this.type !== ProductType.COMBO;
  }

  onFieldChange(): void {
    if (!this.loaded) {
      return;
    }

    const next = this.currentValue();
    if (this.isSameValue(next, this.lastEmitted)) {
      return;
    }

    this.lastEmitted = { ...next };
    this.valueChange.emit(next);
  }

  readValue(): ProductFormBasicFieldsValue {
    return this.currentValue();
  }

  private currentValue(): ProductFormBasicFieldsValue {
    return {
      type: this.type,
      name: this.name,
      published: this.published,
      includesPieces: this.includesPieces,
      finishedStock: Math.max(0, Math.trunc(Number(this.finishedStock) || 0)),
    };
  }

  private isSameValue(
    a: ProductFormBasicFieldsValue,
    b: ProductFormBasicFieldsValue | null,
  ): boolean {
    if (!b) {
      return false;
    }

    return (
      a.type === b.type &&
      a.name === b.name &&
      a.published === b.published &&
      a.includesPieces === b.includesPieces
      && a.finishedStock === b.finishedStock
    );
  }
}
