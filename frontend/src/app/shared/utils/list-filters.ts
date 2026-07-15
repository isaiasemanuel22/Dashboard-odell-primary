import { SupplyCategory } from '../../core/models';
import { SUPPLY_CATEGORY_LABELS } from '../constants/labels';
import { ListFilterOption } from '../../components/db-list-toolbar/db-list-toolbar.component';

export function supplyCategoryFilters(): ListFilterOption<SupplyCategory | 'all'>[] {
  return [
    { value: 'all', label: 'Todos' },
    ...Object.entries(SUPPLY_CATEGORY_LABELS).map(([value, label]) => ({
      value: value as SupplyCategory,
      label,
    })),
  ];
}

export function productTypeFilters(): ListFilterOption<string>[] {
  return [
    { value: 'all', label: 'Todos' },
    { value: 'fdm', label: 'FDM' },
    { value: 'resina', label: 'Resina' },
    { value: 'estampado', label: 'Estampado' },
  ];
}

export type PublishedProductFilter = 'published' | 'unpublished' | 'all';

export function publishedProductFilters(): ListFilterOption<PublishedProductFilter>[] {
  return [
    { value: 'published', label: 'Publicados' },
    { value: 'unpublished', label: 'No publicados' },
    { value: 'all', label: 'Todos' },
  ];
}
