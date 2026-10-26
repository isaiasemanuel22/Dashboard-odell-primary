import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProductType } from '../../../../core/models';
import { DbCheckboxComponent, DbInputComponent } from '@dashboard-form';
import type { DbSelectOption } from '@dashboard-form';

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
  imports: [FormsModule, DbCheckboxComponent, DbInputComponent],
  templateUrl: './product-form-basic-fields.component.html',
  styleUrl: '../product-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductFormBasicFieldsComponent implements OnInit {
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) productTypeOptions!: DbSelectOption[];
  @Output() readonly valueChange =
    new EventEmitter<ProductFormBasicFieldsValue>();

  type: ProductType = ProductType.FDM;
  name = '';
  published = true;
  includesPieces = false;
  finishedStock = 0;

  private ready = false;
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
    this.ready = true;
    this.cdr.markForCheck();
  }

  ngOnInit(): void {
    queueMicrotask(() => {
      if (!this.ready) {
        this.ready = true;
        this.cdr.markForCheck();
      }
    });
  }

  get showIncludesPiecesCheckbox(): boolean {
    return this.type !== ProductType.COMBO;
  }

  selectType(value: string): void {
    this.type = value as ProductType;
    this.onFieldChange();
  }

  typeLabel(value: string): string {
    if (value === ProductType.FDM) return 'Impresión FDM';
    return this.productTypeOptions.find((option) => option.value === value)?.label ?? value;
  }

  onFieldChange(): void {
    const next = this.currentValue();
    if (!this.ready) {
      this.ready = true;
    }

    if (this.isSameValue(next, this.lastEmitted)) {
      return;
    }

    this.lastEmitted = { ...next };
    this.valueChange.emit(next);
  }

  onIncludesPiecesChange(checked: boolean): void {
    this.includesPieces = checked;
    if (!this.ready) {
      this.ready = true;
    }

    const next = this.currentValue();
    if (this.isSameValue(next, this.lastEmitted)) {
      return;
    }

    this.lastEmitted = { ...next };
    this.valueChange.emit(next);
    this.cdr.markForCheck();
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
