import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  DbButtonComponent,
  DbFilterPanelComponent,
  DbPillOption,
  FilterPanelGroup,
  FilterPanelValues,
} from '@general-components';

@Component({
  selector: 'app-products-toolbar',
  standalone: true,
  imports: [FormsModule, RouterLink, DbButtonComponent, DbFilterPanelComponent],
  templateUrl: './products-toolbar.component.html',
  styleUrl: './products-toolbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductsToolbarComponent {
  @Input() publishedCount = 0;
  @Input() targetMarginPercent = 40;
  @Input() cartItemCount = 0;
  @Input() listFilters: DbPillOption[] = [];
  @Input() listFilter = 'all';
  @Input() search = '';
  @Input() typeFilters: { value: string; label: string }[] = [];
  @Input() typeFilter = '';
  @Input() categoryFilterOptions: { value: string; label: string }[] = [];
  @Input() categoryFilter = '';

  @Output() searchChange = new EventEmitter<string>();
  @Input() categoryOptionsForType: (type: string) => { value: string; label: string }[] = () => [];
  @Input() filterCountFn: ((draft: FilterPanelValues) => number) | null = null;
  @Output() filtersApply = new EventEmitter<FilterPanelValues>();
  @Output() newCategory = new EventEmitter<void>();
  @Output() newProduct = new EventEmitter<void>();
  @Output() updatePrices = new EventEmitter<void>();

  get panelGroups(): FilterPanelGroup[] {
    return this.groupsFor({
      list: this.listFilter,
      type: this.typeFilter,
      category: this.categoryFilter,
    });
  }

  get panelValues(): FilterPanelValues {
    return {
      list: this.listFilter,
      type: this.typeFilter,
      category: this.categoryFilter,
    };
  }

  readonly groupsFor = (draft: FilterPanelValues): FilterPanelGroup[] => [
    { id: 'list', title: 'Mostrar', options: this.listFilters },
    { id: 'type', title: 'Tipo', options: this.typeFilters },
    {
      id: 'category',
      title: 'Categoría',
      options: this.categoryOptionsForType(draft['type'] ?? 'all'),
    },
  ];
}
