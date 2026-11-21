import { annualCapPercent, annualCapPercentLabel, uninvoicedDetail } from './sales-invoice.util';

describe('sales-invoice.util', () => {
  it('describe las ventas sin facturar', () => {
    expect(uninvoicedDetail({ uninvoicedCount: 0, uninvoicedRevenue: 0 })).toBe(
      'Todo facturado',
    );
    expect(uninvoicedDetail({ uninvoicedCount: 1, uninvoicedRevenue: 1000 })).toContain(
      '1 venta sin facturar',
    );
    expect(uninvoicedDetail({ uninvoicedCount: 4, uninvoicedRevenue: 1000 })).toContain(
      '4 ventas sin facturar',
    );
  });

  it('calcula el porcentaje del tope, acotado a 100', () => {
    expect(annualCapPercent({ last12MonthsInvoicedRevenue: 500, annualInvoiceCap: 1000 })).toBe(50);
    expect(annualCapPercent({ last12MonthsInvoicedRevenue: 2000, annualInvoiceCap: 1000 })).toBe(100);
    expect(annualCapPercent({ last12MonthsInvoicedRevenue: 500, annualInvoiceCap: null })).toBe(0);
  });
});

describe('annualCapPercentLabel', () => {
  it('usa un decimal debajo de 10 %', () => {
    expect(annualCapPercentLabel({ last12MonthsInvoicedRevenue: 2, annualInvoiceCap: 1000 })).toBe('0,2');
    expect(annualCapPercentLabel({ last12MonthsInvoicedRevenue: 500, annualInvoiceCap: 1000 })).toBe('50');
    expect(annualCapPercentLabel({ last12MonthsInvoicedRevenue: 0, annualInvoiceCap: 1000 })).toBe('0');
  });
});
