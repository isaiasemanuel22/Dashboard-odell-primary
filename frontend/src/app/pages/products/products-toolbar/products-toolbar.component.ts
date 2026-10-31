import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DbButtonComponent, DbPillGroupComponent } from '@general-components';

@Component({
  selector: 'app-products-toolbar',
  standalone: true,
  imports: [FormsModule, RouterLink, DbButtonComponent, DbPillGroupComponent],
  templateUrl: './products-toolbar.component.html',
  styleUrl: './products-toolbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductsToolbarComponent {
  @Input() publishedCount = 0;
  @Input() inStockCount = 0;
  @Input() cartItemCount = 0;
  @Input() catalogFilters: { value: string; label: string }[] = [];
  @Input() catalogView = '';
  @Input() search = '';
  @Input() typeFilters: { value: string; label: string }[] = [];
  @Input() typeFilter = '';
  @Input() categoryFilterOptions: { value: string; label: string }[] = [];
  @Input() categoryFilter = '';

  @Output() catalogViewChange = new EventEmitter<string>();
  @Output() searchChange = new EventEmitter<string>();
  @Output() typeFilterChange = new EventEmitter<string>();
  @Output() categoryFilterChange = new EventEmitter<string>();
  @Output() newCategory = new EventEmitter<void>();
  @Output() newProduct = new EventEmitter<void>();
}
