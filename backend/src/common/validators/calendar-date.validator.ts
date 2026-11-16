import { registerDecorator, ValidationOptions } from 'class-validator';

/** true si los primeros 10 caracteres son un día real del calendario (AAAA-MM-DD). */
export function isRealCalendarDay(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const ymd = value.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

/** Valida que el string empiece con un día real (2026-02-30 se rechaza). */
export function IsRealCalendarDay(options?: ValidationOptions) {
  return (target: object, propertyKey: string | symbol) => {
    registerDecorator({
      name: 'isRealCalendarDay',
      target: target.constructor,
      propertyName: propertyKey as string,
      options: {
        message: 'La fecha no es válida (usá AAAA-MM-DD)',
        ...options,
      },
      validator: { validate: (value: unknown) => isRealCalendarDay(value) },
    });
  };
}
