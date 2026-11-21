import { SaleEntry } from '../../core/models';
import { buildAccountantSheetData } from './sales-accountant-export.util';

describe('buildAccountantSheetData', () => {
  const entry = {
    id: 'e1',
    source: 'order',
    saleId: 'ord-8',
    customerName: 'QA',
    items: [],
    total: 22950,
    cost: 5412,
    profit: 17538,
    soldAt: '2026-10-30T12:00:00.000Z',
    channel: 'whatsapp',
    fees: 808,
    netProfit: 16730,
    paymentMethods: ['mercado_pago'],
    invoice: { type: 'C', number: '0003-00000041', issuedAt: '2026-10-30T12:00:00.000Z' },
    editable: false,
  } as unknown as SaleEntry;

  it('arma encabezado, una fila por venta y total', () => {
    const rows = buildAccountantSheetData([entry, { ...entry, saleId: 'ord-9', invoice: undefined }]);
    expect(rows.length).toBe(4);
    expect((rows[1][0] as { value: string }).value).toBe('ord-8');
    expect((rows[1][10] as { value: string }).value).toBe('Factura C');
    expect((rows[2][10] as { value: string }).value).toBe('Sin facturar');
    expect((rows[3][5] as { value: number }).value).toBe(45900);
    expect((rows[3][8] as { value: number }).value).toBe(33460);
  });
});
