import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { AsyncPipe } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { DbFieldsetComponent } from '@dashboard-form';
import { CurrencyArsPipe } from '../../../../shared/pipes/labels.pipe';
import { ProductFormGroup } from '../services/product-form-state-manager.service';
import { ProductFormPricingFacade } from '../store/product-form-pricing/product-form-pricing.facade';
import { ProductFormFacade } from '../product-form.facade';

@Component({
  selector: 'app-product-form-pricing-section',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AsyncPipe,
    DbFieldsetComponent,
    CurrencyArsPipe,
  ],
  templateUrl: './product-form-pricing-section.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductFormPricingSectionComponent implements OnInit, OnDestroy {
  private readonly pricingStore = inject(ProductFormPricingFacade);
  private readonly destroy$ = new Subject<void>();

  @Input({ required: true }) facade!: ProductFormFacade;
  @Input({ required: true }) form!: ProductFormGroup;

  readonly vm$ = this.pricingStore.vm$;

  ngOnInit(): void {
    this.pricingStore.setSuggestedPrice(
      this.form.controls.suggestedPrice.value,
    );
    this.form.controls.suggestedPrice.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((suggestedPrice) => {
        this.pricingStore.setSuggestedPrice(suggestedPrice);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
