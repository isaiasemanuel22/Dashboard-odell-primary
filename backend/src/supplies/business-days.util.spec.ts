import {
  addCalendarDaysToKey,
  businessDaysToCalendarDays,
  computeOrderByDate,
  subtractBusinessDays,
} from './business-days.util';

describe('business-days.util', () => {
  it('resta días hábiles lun–vie', () => {
    // Viernes 2026-11-06 menos 1 hábil → jueves 05
    expect(subtractBusinessDays('2026-11-06', 1)).toBe('2026-11-05');
    // Lunes 2026-11-09 menos 1 hábil → viernes 06
    expect(subtractBusinessDays('2026-11-09', 1)).toBe('2026-11-06');
  });

  it('orderBy = hoy + covers − demora hábil', () => {
    // hoy 2026-11-09, covers 10 → 2026-11-19, demora 3 hábiles → 2026-11-16
    expect(computeOrderByDate('2026-11-09', 10, 3)).toBe('2026-11-16');
  });

  it('convierte demora hábil a corridos', () => {
    // desde lunes, 3 hábiles → mié = 3 corridos
    expect(businessDaysToCalendarDays('2026-11-09', 3)).toBe(3);
    // desde viernes, 1 hábil → lunes = 3 corridos
    expect(businessDaysToCalendarDays('2026-11-06', 1)).toBe(3);
  });

  it('suma días corridos', () => {
    expect(addCalendarDaysToKey('2026-11-09', 7)).toBe('2026-11-16');
  });
});
