import {
  fairCashDifference,
  fairCashStatus,
  fairExpectedCash,
  fairMonthParam,
  fairPlanItemsToPrint,
  fairPlanTaskName,
  fairReasonRequired,
  fairResult,
  formatFairDate,
  formatSignedAmount,
  pickFairForFairMode,
  shiftFairMonth,
} from './fair.util';

describe('fair.util (cierre de caja)', () => {
  it('esperado = fondo + ventas en efectivo', () => {
    expect(fairExpectedCash(10000, 31500)).toBe(41500);
  });

  it('diferencia = contado − esperado', () => {
    expect(fairCashDifference(41000, 41500)).toBe(-500);
    expect(fairCashDifference(41500, 41500)).toBe(0);
    expect(fairCashDifference(42000, 41500)).toBe(500);
  });

  it('el motivo solo es obligatorio si hay diferencia', () => {
    expect(fairReasonRequired(0)).toBe(false);
    expect(fairReasonRequired(-500)).toBe(true);
    expect(fairReasonRequired(0.4)).toBe(true);
  });

  it('resultado = vendido − costo − gastos', () => {
    expect(fairResult(52000, 19850, 11000)).toBe(21150);
  });

  it('estado de caja para la tabla', () => {
    expect(fairCashStatus({ status: 'planned', cashDifference: null }).label).toBe('Planificada');
    expect(fairCashStatus({ status: 'open', cashDifference: null }).label).toBe('Abierta');
    expect(fairCashStatus({ status: 'closed', cashDifference: 0 })).toEqual({
      label: 'OK',
      tone: 'ok',
    });
    expect(fairCashStatus({ status: 'closed', cashDifference: -500 })).toEqual({
      label: '−$ 500',
      tone: 'warn',
    });
  });

  it('formatea importes con signo', () => {
    expect(formatSignedAmount(-2250)).toBe('−$ 2.250');
    expect(formatSignedAmount(500)).toBe('+$ 500');
  });

  it('mes como YYYY-MM y navegación', () => {
    expect(fairMonthParam(new Date(2026, 9, 31))).toBe('2026-10');
    expect(fairMonthParam(shiftFairMonth(new Date(2026, 0, 31), -1))).toBe('2025-12');
  });

  it('fecha corta sin corrimiento horario', () => {
    expect(formatFairDate('2026-10-31')).toMatch(/31\/10$/);
  });

  it('modo feria: abierta primero, si no la planificada de hoy', () => {
    const fairs = [
      { id: 'a', status: 'planned' as const, date: '2026-11-17' },
      { id: 'b', status: 'planned' as const, date: '2026-11-24' },
    ];
    expect(pickFairForFairMode(fairs, '2026-11-17')).toEqual({
      fair: fairs[0],
      needsOpening: true,
    });
    expect(pickFairForFairMode(fairs, '2026-11-18')).toBeNull();
    const open = { id: 'c', status: 'open' as const, date: '2026-11-10' };
    expect(pickFairForFairMode([...fairs, open], '2026-11-18')).toEqual({
      fair: open,
      needsOpening: false,
    });
  });

  it('tareas de cola solo para lo que falta imprimir', () => {
    const items = [
      { productId: '1', name: 'Llavero 3D', average: 13, stock: 20, take: 15, toPrint: 0 },
      { productId: '2', name: 'Árbol', average: 3, stock: 2, take: 4, toPrint: 2 },
    ];
    expect(fairPlanItemsToPrint(items)).toEqual([items[1]]);
    expect(fairPlanTaskName(items[1])).toBe('Imprimir 2× Árbol');
  });
});
