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
import { AsyncPipe } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { CurrencyArsPipe } from '../../../../shared/pipes/labels.pipe';
import {
  GeneralSettings,
  MachineProfileRole,
  ProductType,
} from '../../../../core/models';
import { SettingsFacade } from '../../../../store/settings/settings.facade';
import { getMachineProfilesForProductType } from '../../../../shared/utils/machine-profile.util';
import { totalFdmFilamentGrams } from '../../../../shared/utils/fdm.helpers';
import { ProductFormGroup } from '../services/product-form-state-manager.service';
import { ProductFormPricingFacade } from '../store/product-form-pricing/product-form-pricing.facade';
import { ProductFormFacade } from '../product-form.facade';
import { DbInputComponent } from '@dashboard-form';

@Component({
  selector: 'app-product-form-pricing-section',
  standalone: true,
  imports: [ReactiveFormsModule, AsyncPipe, CurrencyArsPipe, DbInputComponent],
  templateUrl: './product-form-pricing-section.component.html',
  styleUrl: '../product-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductFormPricingSectionComponent implements OnInit, OnDestroy {
  private readonly pricingStore = inject(ProductFormPricingFacade);
  private readonly settingsFacade = inject(SettingsFacade);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();
  private settings: GeneralSettings | null = null;

  @Input({ required: true }) facade!: ProductFormFacade;
  @Input({ required: true }) form!: ProductFormGroup;

  readonly vm$ = this.pricingStore.vm$;

  ngOnInit(): void {
    this.pricingStore.setSuggestedPrice(this.form.controls.suggestedPrice.value);
    this.form.controls.suggestedPrice.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((suggestedPrice) => {
        this.pricingStore.setSuggestedPrice(suggestedPrice);
      });
    this.form.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.cdr.markForCheck();
    });
    this.settingsFacade
      .watchGeneralSettings()
      .pipe(takeUntil(this.destroy$))
      .subscribe((settings) => {
        this.settings = settings;
        this.cdr.markForCheck();
      });
  }

  get gramsLabel(): string | null {
    const type = this.form.controls.type.value;
    if (type === ProductType.FDM) {
      return `${totalFdmFilamentGrams(this.form.controls.filamentLines.value)} g`;
    }
    if (type === ProductType.RESINA) {
      return `${Number(this.form.controls.grams.value) || 0} ml`;
    }
    return null;
  }

  get lightLabel(): string | null {
    const printer = this.printProfile();
    return printer ? `${printer.watts} W` : null;
  }

  get machineLabel(): string | null {
    const printer = this.printProfile();
    return printer ? `${this.money(printer.costPerHour)}/h` : null;
  }

  get errorMarginLabel(): string | null {
    if (!this.settings) return null;
    return `${this.settings.errorMarginPercent}%`;
  }

  get laborLabel(): string | null {
    if (!this.settings) return null;
    return `${this.money(this.settings.laborCostPerHour)}/h`;
  }

  get piecesUnitsLabel(): string | null {
    const units = this.facade.components.reduce(
      (sum, item) => sum + Math.max(1, Math.trunc(Number(item.quantity) || 1)),
      0,
    );
    return units > 0 ? `${units} u` : null;
  }

  get assemblyHoursLabel(): string | null {
    const hours = Number(this.form.controls.assemblyTimeHours.value) || 0;
    if (hours <= 0) return null;
    return `${String(hours).replace('.', ',')} h`;
  }

  setSavings(componentsPrice: number, salePrice: number): number {
    return Math.max(0, Math.round((Number(componentsPrice) || 0) - (Number(salePrice) || 0)));
  }

  private printProfile() {
    if (!this.settings) return null;
    const printers = getMachineProfilesForProductType(
      this.settings,
      this.form.controls.type.value,
    ).filter((profile) => profile.role === MachineProfileRole.PRINT);
    return printers.length === 1 ? printers[0] : null;
  }

  private money(value: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(value);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
