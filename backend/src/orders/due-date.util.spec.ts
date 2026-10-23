import {
  DUE_DATE_AFTER_TODAY_MESSAGE,
  isDueDateAfterToday,
} from './due-date.util';

describe('due-date.util', () => {
  const today = new Date(2026, 9, 21, 15, 0, 0);

  it('acepta un día posterior a hoy', () => {
    expect(isDueDateAfterToday('2026-10-22', today)).toBe(true);
    expect(isDueDateAfterToday('2026-10-28T18:00:00.000Z', today)).toBe(true);
  });

  it('rechaza hoy y una fecha anterior', () => {
    expect(isDueDateAfterToday('2026-10-21', today)).toBe(false);
    expect(isDueDateAfterToday('2026-10-20T18:00:00.000Z', today)).toBe(false);
    expect(DUE_DATE_AFTER_TODAY_MESSAGE).toContain('posterior a hoy');
  });
});
