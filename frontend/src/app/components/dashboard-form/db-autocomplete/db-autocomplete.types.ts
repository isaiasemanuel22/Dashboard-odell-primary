export interface DbAutocompleteOption {
  value: string;
  label: string;
  /** Texto extra por el que también se busca (p. ej. teléfono). */
  searchText?: string;
}
