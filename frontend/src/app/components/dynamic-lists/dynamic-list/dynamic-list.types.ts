import type { DbSelectOption } from '@dashboard-form/db-select/db-select.types';

export interface DynamicInputFieldConfig {
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
  changeFn?: (item: any, items: any[]) => void;
}

export interface DynamicSelectFieldConfig {
  type: 'select';
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  fullWidth?: boolean;
  options?: DbSelectOption[];
  optionsFn?: (item: any, items: any[]) => DbSelectOption[];
  hidden?: boolean;
  changeFn?: (item: any, items: any[]) => void;
}

export interface DynamicTextareaFieldConfig {
  type: 'textarea';
  name: string;
  label: string;
  placeholder?: string;
  fullWidth?: boolean;
  changeFn?: (item: any, items: any[]) => void;
}

export interface DynamicDimensionsFieldConfig {
  type: 'dimensions';
  label?: string;
  widthName: string;
  lengthName: string;
  widthLabel?: string;
  lengthLabel?: string;
  min?: number;
  step?: number;
  /** En tabla: si devuelve texto, la medida se muestra de solo lectura. */
  readonlyText?: (item: any) => string | null;
  changeFn?: (item: any, items: any[]) => void;
}

export interface DynamicColorSelectFieldConfig {
  type: 'color-select';
  name: string;
  label: string;
  required?: boolean;
  fullWidth?: boolean;
  appearance?: 'panel' | 'popover';
  /** Filtros de stock para `db-color-select` (no se pasan opciones). */
  filamentTypeFrom?: (item: any) => string | null | undefined;
  resinTypeFrom?: (item: any) => string | null | undefined;
  supplyCategoryFrom?: (item: any) => string | null | undefined;
  supplyIdFrom?: (item: any) => string | null | undefined;
  hidden?: boolean;
  changeFn?: (item: any, items: any[]) => void;
}

export interface DynamicDisplayColumn {
  label: string;
  render: (item: any) => {
    text: string;
    hint?: string;
    tone?: 'plain' | 'missing' | 'strong';
  };
}

export type DynamicFieldConfig =
  | DynamicInputFieldConfig
  | DynamicSelectFieldConfig
  | DynamicColorSelectFieldConfig
  | DynamicTextareaFieldConfig
  | DynamicDimensionsFieldConfig;

export interface DynamicListConfig {
  legend: string;
  description: string;
  itemLabel: (index: number) => string;
  fields: DynamicFieldConfig[];
  createItem: () => any;
  minItems?: number;
  showRemoveButton?: (items: any[]) => boolean;
  addButtonLabel: string;
  emptyMessage?: string;
  totalLabel?: string;
  totalValueFn?: (items: any[]) => string | number;
  layout?: 'cards' | 'table';
  /** Columnas CSS grid de la tabla (`--line-table-columns`). */
  tableColumns?: string;
  showAddButton?: boolean;
  /** `inside` deja el botón de agregar en la misma fila que el total. */
  addPlacement?: 'below' | 'inside';
  headerAside?: () => string;
  footnote?: string;
  footerActionLabel?: string;
  displayColumns?: DynamicDisplayColumn[];
  rowCost?: (item: any) => number;
}
