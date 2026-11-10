/** Tamaño de archivo con coma decimal es-AR («1,1 KB», «840 KB», «1,2 MB»). */
export function formatFileSizeEsAr(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const decimals = unitIndex === 0 ? 0 : value >= 100 ? 0 : 1;
  const formatted = new Intl.NumberFormat('es-AR', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: 0,
  }).format(value);
  return `${formatted} ${units[unitIndex]}`;
}
