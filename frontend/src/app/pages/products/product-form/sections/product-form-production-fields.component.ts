import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import {
  FilamentType,
  ProductType,
  isProductType3D,
} from '../../../../core/models';
import { ProductFormGroup } from '../../../../core/services/product-form-state-manager.service';
import {
  DbFormGridComponent,
  DbFormGridFullComponent,
  DbInputComponent,
  DbSelectComponent,
} from '@general-components';
import {
  FilamentLineListComponent,
  PressCycleListComponent,
  PrintSpecListComponent,
  SupplyLineListComponent,
} from '../../../../shared/components/dynamic-lists/public-api';
import { resinTypeOptions } from '../../../../shared/utils/select-options';

@Component({
  selector: 'app-product-form-production-fields',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DbFormGridComponent,
    DbFormGridFullComponent,
    DbInputComponent,
    DbSelectComponent,
    PrintSpecListComponent,
    SupplyLineListComponent,
    PressCycleListComponent,
    FilamentLineListComponent,
  ],
  templateUrl: './product-form-production-fields.component.html',
  styleUrl: '../product-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductFormProductionFieldsComponent {
  @Input({ required: true }) form!: ProductFormGroup;
  @Input({ required: true }) productType!: ProductType;
  @Input() includesPieces = false;

  readonly resinTypeOptions = resinTypeOptions();

  get showProductionFields(): boolean {
    return this.productType !== ProductType.COMBO && !this.includesPieces;
  }

  get showGenericSizeField(): boolean {
    return (
      this.productType !== ProductType.COMBO &&
      (this.productType !== ProductType.ESTAMPADO || this.includesPieces)
    );
  }

  get isEstampado(): boolean {
    return this.productType === ProductType.ESTAMPADO;
  }

  get isFdm(): boolean {
    return this.productType === ProductType.FDM;
  }

  get isResina(): boolean {
    return this.productType === ProductType.RESINA;
  }

  get is3D(): boolean {
    return isProductType3D(this.productType);
  }

  get filamentType(): FilamentType {
    return this.form.controls.filamentType.value;
  }
}
