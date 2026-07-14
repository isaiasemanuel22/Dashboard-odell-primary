import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProductType } from '../../../core/models';
import { productTypeOptions } from '../../../shared/utils/select-options';
import {
  DbCheckboxComponent,
  DbCheckboxGroupComponent,
  DbFieldsetComponent,
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
    DbFieldsetComponent,
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
    if (changes['presetProductType'] && this.presetProductType) {
      this.selectedTypes = [this.presetProductType];
    }
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
