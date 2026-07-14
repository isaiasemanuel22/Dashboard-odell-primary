export interface DbSelectOption<T = string> {
  value: T;
  label: string;
  disabled?: boolean;
}
