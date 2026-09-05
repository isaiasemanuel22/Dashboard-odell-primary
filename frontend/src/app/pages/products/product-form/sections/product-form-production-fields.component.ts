import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import {
  FilamentType,
  GeneralSettings,
  ProductType,
  Supply,
  SupplyCategory,
  INDISTINTO_COLOR_ID,
  isProductType3D,
} from '../../../../core/models';
import { SuppliesService } from '../../../../core/services/settings.service';
import { ProductFormGroup } from '../services/product-form-state-manager.service';
import { SettingsFacade } from '../../../../store/settings/settings.facade';
import {
  DbFormGridComponent,
  DbFormGridFullComponent,
  DbInputComponent,
  DbColorSelectComponent,
  DbSelectComponent,
} from '@dashboard-form';
import type { DbColorSelectOption } from '@dashboard-form';
import {
  FilamentLineListComponent,
  PressCycleListComponent,
  PrintSpecListComponent,
  SupplyLineListComponent,
} from '../dynamic-lists/public-api';
import { buildColorOptions } from '../../../../shared/utils/color.helpers';
import { resinTypeOptions } from '../../../../shared/utils/select-options';

@Component({
  selector: 'app-product-form-production-fields',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DbFormGridComponent,
    DbFormGridFullComponent,
    DbInputComponent,
    DbColorSelectComponent,
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
export class ProductFormProductionFieldsComponent implements OnInit, OnDestroy {
  @Input({ required: true }) form!: ProductFormGroup;
  @Input({ required: true }) productType!: ProductType;
  @Input() includesPieces = false;

  private readonly settingsFacade = inject(SettingsFacade);
  private readonly suppliesService = inject(SuppliesService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  private generalSettings: GeneralSettings | null = null;
  private resinSupplies: Supply[] = [];

  readonly resinTypeOptions = resinTypeOptions();

  ngOnInit(): void {
    this.settingsFacade
      .watchGeneralSettings()
      .pipe(takeUntil(this.destroy$))
      .subscribe((settings) => {
        this.generalSettings = settings;
        this.cdr.markForCheck();
      });

    this.suppliesService
      .watchSupplies(SupplyCategory.RESINA)
      .pipe(takeUntil(this.destroy$))
      .subscribe((items) => {
        this.resinSupplies = items.filter((supply) => Boolean(supply.resinType));
        this.cdr.markForCheck();
      });

    this.form.controls.resinType.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.form.controls.colorId.setValue(INDISTINTO_COLOR_ID);
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

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

  get resinColorOptions(): DbColorSelectOption[] {
    return buildColorOptions(
      this.resinSupplies,
      this.generalSettings?.colors ?? [],
      { resinType: this.form.controls.resinType.value },
    );
  }
}
