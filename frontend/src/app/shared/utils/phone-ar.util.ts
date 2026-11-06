/**
 * Formato legible de teléfono AR para mostrar.
 * No altera el valor guardado: solo la cadena de presentación.
 */
export function formatPhoneArDisplay(raw: string | null | undefined): string {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed) return '';

  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return trimmed;

  // +54 9 11 1234-5678 / +54 11 1234-5678
  if (digits.startsWith('54') && digits.length >= 12) {
    const rest = digits.slice(2);
    if (rest.startsWith('9') && rest.length >= 11) {
      const area = rest.slice(1, 3);
      const local = rest.slice(3);
      return `+54 9 ${area} ${splitLocal(local)}`;
    }
    const area = rest.slice(0, 2);
    const local = rest.slice(2);
    return `+54 ${area} ${splitLocal(local)}`;
  }

  // 11 1234-5678 / 011 15 1234-5678
  if (digits.length === 10) {
    return `${digits.slice(0, 2)} ${splitLocal(digits.slice(2))}`;
  }
  if (digits.length === 11 && digits.startsWith('15')) {
    return `15 ${splitLocal(digits.slice(2))}`;
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    const withoutZero = digits.slice(1);
    if (withoutZero.startsWith('15') && withoutZero.length >= 10) {
      return `0${withoutZero.slice(0, 2)} ${withoutZero.slice(2, 4)} ${splitLocal(withoutZero.slice(4))}`;
    }
    return `0${withoutZero.slice(0, 2)} ${splitLocal(withoutZero.slice(2))}`;
  }

  if (hasPlus) return `+${digits}`;
  return trimmed;
}

function splitLocal(local: string): string {
  if (local.length <= 4) return local;
  const head = local.slice(0, local.length - 4);
  const tail = local.slice(-4);
  return `${head}-${tail}`;
}
