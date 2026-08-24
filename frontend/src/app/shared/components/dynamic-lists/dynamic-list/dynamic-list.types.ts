import { DbSelectOption } from '@general-components';

export interface DynamicInputFieldConfig {
  type: 'input';
  name: string;
  label: string;
  placeholder?: string;
  inputType?: 'text' | 'number' | 'email' | 'date';
  min?: number;
  max?: number;
  step?: number;
  required?: boolean;
  fullWidth?: boolean;
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
  widthName: string;
  lengthName: string;
  widthLabel?: string;
  lengthLabel?: string;
  min?: number;
  step?: number;
  changeFn?: (item: any, items: any[]) => void;
}

export type DynamicFieldConfig =
  | DynamicInputFieldConfig
  | DynamicSelectFieldConfig
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
}
