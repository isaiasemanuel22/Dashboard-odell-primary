/** Pesos enteros, el mismo formato que el pipe `currencyArs`. */
export function formatCurrencyArs(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value);
}
