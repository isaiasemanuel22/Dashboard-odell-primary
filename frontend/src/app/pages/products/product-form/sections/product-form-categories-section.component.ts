import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { Category, ProductType } from '../../../../core/models';
import { CatalogFacade } from '../../../../store/catalog/catalog.facade';
import { DbButtonComponent } from '../../../../components/db-button/db-button.component';
import {
  DbFieldsetComponent,
  DbSelectComponent,
} from '@dashboard-form';
import type { DbSelectOption } from '@dashboard-form';
import { FormDialogService } from '../../../../shared/form-dialogs/public-api';

@Component({
  selector: 'app-product-form-categories-section',
  standalone: true,
  imports: [
    FormsModule,
    DbFieldsetComponent,
    DbSelectComponent,
    DbButtonComponent,
  ],
  templateUrl: './product-form-categories-section.component.html',
  styleUrl: '../product-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductFormCategoriesSectionComponent implements OnInit, OnDestroy {
  private readonly catalogFacade = inject(CatalogFacade);
  private readonly formDialogs = inject(FormDialogService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  @Output() readonly valueChange = new EventEmitter<string[]>();

  categoriesList: Category[] = [];
  categoryIds: string[] = [];
  categoryPicker = '';

  private loaded = false;
  private lastEmitted: string[] | null = null;
  private currentProductType: ProductType = ProductType.FDM;

  @Input() set productType(type: ProductType) {
    if (this.currentProductType === type) {
      return;
    }

    this.currentProductType = type;
    this.filterCategoryIdsForType();
    this.categoryPicker = '';
    this.cdr.markForCheck();
  }

  @Input() set value(ids: string[] | null) {
    if (!ids) {
      return;
    }

    if (!this.sameIds(ids, this.categoryIds)) {
      this.categoryIds = [...ids];
    }

    this.lastEmitted = [...ids];
    this.loaded = true;
    this.cdr.markForCheck();
  }

  ngOnInit(): void {
    this.catalogFacade.load(false);
    this.catalogFacade.categories$
      .pipe(takeUntil(this.destroy$))
      .subscribe((categories) => {
        this.categoriesList = categories;
        this.filterCategoryIdsForType();
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get filteredCategoriesList(): Category[] {
    return this.categoriesList.filter((category) =>
      category.productTypes.includes(this.currentProductType),
    );
  }

  get unselectedCategoryOptions(): DbSelectOption[] {
    return this.filteredCategoriesList
      .filter((category) => !this.categoryIds.includes(category.id))
      .map((category) => ({ value: category.id, label: category.name }));
  }

  get selectedCategoriesList(): Category[] {
    return this.categoryIds
      .map((id) => this.categoriesList.find((category) => category.id === id))
      .filter((category): category is Category => Boolean(category));
  }

  get canAddCategory(): boolean {
    return (
      this.categoryIds.length < 5 && this.unselectedCategoryOptions.length > 0
    );
  }

  onPickerChange(id: string): void {
    if (!id || !this.loaded) {
      return;
    }

    if (
      this.categoryIds.includes(id) ||
      this.categoryIds.length >= 5 ||
      !this.canAddCategory
    ) {
      this.categoryPicker = '';
      return;
    }

    this.categoryIds = [...this.categoryIds, id];
    this.categoryPicker = '';
    this.emitIfLoaded();
  }

  removeCategory(id: string): void {
    if (!this.loaded) {
      return;
    }

    this.categoryIds = this.categoryIds.filter((categoryId) => categoryId !== id);
    this.emitIfLoaded();
  }

  openCategoryForm(): void {
    this.formDialogs.openCategory(this.currentProductType).subscribe((category) => {
      if (!category) {
        return;
      }

      this.catalogFacade.upsertCategory(category);

      if (
        category.productTypes.includes(this.currentProductType) &&
        !this.categoryIds.includes(category.id) &&
        this.categoryIds.length < 5
      ) {
        this.categoryIds = [...this.categoryIds, category.id];
        this.emitIfLoaded();
      }

      this.cdr.markForCheck();
    });
  }

  private filterCategoryIdsForType(): void {
    if (!this.loaded || !this.categoriesList.length) {
      return;
    }

    const validIds = this.categoryIds.filter((id) =>
      this.filteredCategoriesList.some((category) => category.id === id),
    );

    if (!this.sameIds(validIds, this.categoryIds)) {
      this.categoryIds = validIds;
      this.emitIfLoaded();
    }
  }

  private emitIfLoaded(): void {
    if (!this.loaded) {
      return;
    }

    const next = [...this.categoryIds];
    if (this.sameIds(next, this.lastEmitted)) {
      return;
    }

    this.lastEmitted = next;
    this.valueChange.emit(next);
    this.cdr.markForCheck();
  }

  readValue(): string[] {
    return [...this.categoryIds];
  }

  private sameIds(a: string[], b: string[] | null): boolean {
    if (!b || a.length !== b.length) {
      return false;
    }

    return a.every((id, index) => id === b[index]);
  }
}
