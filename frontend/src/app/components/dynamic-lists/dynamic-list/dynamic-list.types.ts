import type { DbSelectOption } from '@dashboard-form/db-select/db-select.types';

export interface DynamicInputFieldConfig<T> {
  type: 'input';
  name: string;
  label: string;
  placeholder?: string;
  suffix?: string;
  inputType?: 'text' | 'number' | 'email' | 'date';
  min?: number;
  max?: number;
  step?: number;
  required?: boolean;
  fullWidth?: boolean;
  hidden?: boolean;
  control?: 'stepper';
  changeFn?: (item: T, items: T[]) => void;
}

export interface DynamicSelectFieldConfig<T> {
  type: 'select';
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  fullWidth?: boolean;
  options?: DbSelectOption[];
  optionsFn?: (item: T, items: T[]) => DbSelectOption[];
  hidden?: boolean;
  changeFn?: (item: T, items: T[]) => void;
}

export interface DynamicTextareaFieldConfig<T> {
  type: 'textarea';
  name: string;
  label: string;
  placeholder?: string;
  fullWidth?: boolean;
  changeFn?: (item: T, items: T[]) => void;
}

export interface DynamicDimensionsFieldConfig<T> {
  type: 'dimensions';
  label?: string;
  widthName: string;
  lengthName: string;
  widthLabel?: string;
  lengthLabel?: string;
  min?: number;
  step?: number;
  /** En tabla: si devuelve texto, la medida se muestra de solo lectura. */
  readonlyText?: (item: T) => string | null;
  changeFn?: (item: T, items: T[]) => void;
}

export interface DynamicColorSelectFieldConfig<T> {
  type: 'color-select';
  name: string;
  label: string;
  required?: boolean;
  fullWidth?: boolean;
  appearance?: 'panel' | 'popover';
  /** Filtros de stock para `db-color-select` (no se pasan opciones). */
  filamentTypeFrom?: (item: T) => string | null | undefined;
  resinTypeFrom?: (item: T) => string | null | undefined;
  supplyCategoryFrom?: (item: T) => string | null | undefined;
  supplyIdFrom?: (item: T) => string | null | undefined;
  hidden?: boolean;
  changeFn?: (item: T, items: T[]) => void;
}

export interface DynamicDisplayColumn<T> {
  label: string;
  render: (item: T) => {
    text: string;
    hint?: string;
    tone?: 'plain' | 'missing' | 'strong';
  };
}

export type DynamicFieldConfig<T> =
  | DynamicInputFieldConfig<T>
  | DynamicSelectFieldConfig<T>
  | DynamicColorSelectFieldConfig<T>
  | DynamicTextareaFieldConfig<T>
  | DynamicDimensionsFieldConfig<T>;

export interface DynamicListConfig<T> {
  legend: string;
  description: string;
  itemLabel: (index: number) => string;
  fields: DynamicFieldConfig<T>[];
  createItem: () => T;
  minItems?: number;
  showRemoveButton?: (items: T[]) => boolean;
  addButtonLabel: string;
  emptyMessage?: string;
  totalLabel?: string;
  totalValueFn?: (items: T[]) => string | number;
  layout?: 'cards' | 'table';
  /** Columnas CSS grid de la tabla (`--line-table-columns`). */
  tableColumns?: string;
  showAddButton?: boolean;
  /** `inside` deja el botón de agregar en la misma fila que el total. */
  addPlacement?: 'below' | 'inside';
  headerAside?: () => string;
  footnote?: string;
  footerActionLabel?: string;
  displayColumns?: DynamicDisplayColumn<T>[];
  rowCost?: (item: T) => number;
}
