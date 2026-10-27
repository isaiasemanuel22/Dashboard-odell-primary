import {
  ChangeDetectionStrategy,
  Component,
  Input,
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import {
  FilamentType,
  ProductType,
  isProductType3D,
} from '../../../../core/models';
import { ProductFormGroup } from '../services/product-form-state-manager.service';
import { DbInputComponent } from '@dashboard-form';
import {
  FilamentLineListComponent,
  PressCycleListComponent,
  PrintSpecListComponent,
  ResinLineListComponent,
  SupplyLineListComponent,
} from '../dynamic-lists/public-api';

@Component({
  selector: 'app-product-form-production-fields',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DbInputComponent,
    PrintSpecListComponent,
    SupplyLineListComponent,
    PressCycleListComponent,
    FilamentLineListComponent,
    ResinLineListComponent,
  ],
  templateUrl: './product-form-production-fields.component.html',
  styleUrl: '../product-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductFormProductionFieldsComponent {
  @Input({ required: true }) form!: ProductFormGroup;
  @Input({ required: true }) productType!: ProductType;
  @Input() includesPieces = false;

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
