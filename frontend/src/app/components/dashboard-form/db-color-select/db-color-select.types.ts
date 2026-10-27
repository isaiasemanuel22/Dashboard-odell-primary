import type { DbSelectOption } from '../db-select/db-select.types';

export interface DbColorSelectOption<T = string> extends DbSelectOption<T> {
  hex?: string;
  hint?: string;
  inStock?: boolean;
}
