import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Category, ProductType } from '../../../core/models';
import { productTypeOptions } from '../../../shared/utils/select-options';
import {
  DbCheckboxComponent,
  DbCheckboxGroupComponent,
  DbFormComponent,
  DbFormErrorComponent,
  DbFormFooterComponent,
  DbInputComponent,
  DbButtonComponent,
} from '@general-components';

@Component({
  selector: 'app-category-form',
  standalone: true,
  imports: [
    FormsModule,
    DbFormComponent,
    DbInputComponent,
    DbCheckboxGroupComponent,
    DbCheckboxComponent,
    DbFormErrorComponent,
    DbFormFooterComponent,
    DbButtonComponent,
  ],
  templateUrl: './category-form.component.html',
  styleUrl: './category-form.component.scss',
})
export class CategoryFormComponent implements OnChanges {
  @Input() loading = false;
  @Input() error = '';
  @Input() presetProductType?: ProductType;
  /** Categoría a editar; sin ella el formulario crea una nueva. */
  @Input() category: Category | null = null;
  @Output() save = new EventEmitter<{
    name: string;
    productTypes: ProductType[];
  }>();
  @Output() cancel = new EventEmitter<void>();

  name = '';
  selectedTypes: ProductType[] = [];
  readonly ProductType = ProductType;
  readonly typeOptions = productTypeOptions();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['category'] && this.category) {
      this.name = this.category.name;
      this.selectedTypes = [...this.category.productTypes];
      this.initialSignature = this.signature();
      return;
    }
    if (changes['presetProductType'] && this.presetProductType) {
      this.selectedTypes = [this.presetProductType];
      this.initialSignature = this.signature();
    }
  }

  private initialSignature = this.signature();

  private signature(): string {
    return JSON.stringify([
      this.name.trim(),
      [...this.selectedTypes].sort(),
    ]);
  }

  hasUnsavedChanges(): boolean {
    return this.signature() !== this.initialSignature;
  }

  toggleType(type: ProductType): void {
    if (this.selectedTypes.includes(type)) {
      this.selectedTypes = this.selectedTypes.filter((t) => t !== type);
    } else {
      this.selectedTypes = [...this.selectedTypes, type];
    }
  }

  onTypeCheck(type: ProductType, checked: boolean): void {
    if (checked) {
      if (!this.selectedTypes.includes(type)) {
        this.selectedTypes = [...this.selectedTypes, type];
      }
    } else {
      this.selectedTypes = this.selectedTypes.filter((t) => t !== type);
    }
  }

  isSelected(type: ProductType): boolean {
    return this.selectedTypes.includes(type);
  }

  onSubmit(): void {
    this.save.emit({
      name: this.name.trim(),
      productTypes: this.selectedTypes,
    });
  }
}
