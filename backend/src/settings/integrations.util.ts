import { BadRequestException } from '@nestjs/common';
import { IntegrationsSettings, SaleInvoice } from '../common/interfaces';

export const MAX_FEE_PERCENT = 99.99;

export function defaultIntegrations(): IntegrationsSettings {
  return {
    mercadoPago: { feePercent: 0 },
    arca: { pointOfSale: null, annualCap: null },
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeFeePercent(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(MAX_FEE_PERCENT, Math.round(n * 100) / 100);
}

function normalizePointOfSale(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 99999 ? n : null;
}

function normalizeAnnualCap(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

/** Lee `integrations` desde la base o un cliente; tolera nulo y datos viejos. */
export function normalizeIntegrations(raw: unknown): IntegrationsSettings {
  const rec = asRecord(raw);
  const mp = asRecord(rec.mercadoPago);
  const arca = asRecord(rec.arca);
  return {
    mercadoPago: { feePercent: normalizeFeePercent(mp.feePercent) },
    arca: {
      pointOfSale: normalizePointOfSale(arca.pointOfSale),
      annualCap: normalizeAnnualCap(arca.annualCap),
    },
  };
}

export interface IntegrationsPatch {
  mercadoPago?: { feePercent?: number };
  arca?: { pointOfSale?: number | null; annualCap?: number | null };
}

/** Aplica un parche parcial validando; las claves ausentes no se tocan. */
export function applyIntegrationsPatch(
  current: unknown,
  patch: IntegrationsPatch,
): IntegrationsSettings {
  const base = normalizeIntegrations(current);

  const fee = patch.mercadoPago?.feePercent;
  if (fee !== undefined) {
    if (!Number.isFinite(Number(fee)) || fee < 0 || fee > MAX_FEE_PERCENT) {
      throw new BadRequestException('La comisión debe estar entre 0 y 99,99 %');
    }
    base.mercadoPago.feePercent = normalizeFeePercent(fee);
  }

  if (patch.arca?.pointOfSale !== undefined) {
    const pos = patch.arca.pointOfSale;
    if (pos !== null && normalizePointOfSale(pos) === null) {
      throw new BadRequestException(
        'El punto de venta debe ser un entero entre 1 y 99999',
      );
    }
    base.arca.pointOfSale = normalizePointOfSale(pos);
  }
  if (patch.arca?.annualCap !== undefined) {
    const cap = patch.arca.annualCap;
    if (cap !== null && normalizeAnnualCap(cap) === null) {
      throw new BadRequestException('El tope anual no puede ser negativo');
    }
    base.arca.annualCap = normalizeAnnualCap(cap);
  }

  return base;
}

/** `3-41` → `0003-00000041`. Rechaza formatos inválidos y ceros. */
export function normalizeInvoiceNumber(raw: string): string {
  const match = /^(\d{1,5})-(\d{1,8})$/.exec((raw ?? '').trim());
  if (!match) {
    throw new BadRequestException(
      'El número de factura debe tener el formato 0003-00000041',
    );
  }
  const [, pos, num] = match;
  if (Number(pos) === 0 || Number(num) === 0) {
    throw new BadRequestException(
      'El punto de venta y el número de factura no pueden ser cero',
    );
  }
  return `${pos.padStart(4, '0')}-${num.padStart(8, '0')}`;
}

/** Arma la factura C a partir del DTO. `issuedAt` inválido o ausente → ahora. */
export function buildSaleInvoice(
  number: string,
  issuedAt?: string,
  now: Date = new Date(),
): SaleInvoice {
  let date = now;
  if (issuedAt) {
    const parsed = new Date(issuedAt);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('La fecha de factura no es válida');
    }
    date = parsed;
  }
  return {
    type: 'C',
    number: normalizeInvoiceNumber(number),
    issuedAt: date.toISOString(),
  };
}

/** Reconstruye la factura desde las columnas de la base; incompleta → undefined. */
export function invoiceFromColumns(row: {
  invoiceType?: string | null;
  invoiceNumber?: string | null;
  invoicedAt?: Date | null;
}): SaleInvoice | undefined {
  if (row.invoiceType !== 'C' || !row.invoiceNumber || !row.invoicedAt) {
    return undefined;
  }
  return {
    type: 'C',
    number: row.invoiceNumber,
    issuedAt: row.invoicedAt.toISOString(),
  };
}

/** Columnas de la base para una factura (o todas nulas). */
export function invoiceToColumns(invoice?: SaleInvoice): {
  invoiceType: string | null;
  invoiceNumber: string | null;
  invoicedAt: Date | null;
} {
  return {
    invoiceType: invoice?.type ?? null,
    invoiceNumber: invoice?.number ?? null,
    invoicedAt: invoice ? new Date(invoice.issuedAt) : null,
  };
}

/**
 * Rechaza un número de factura ya usado por otra venta (pedido o mostrador/feria).
 * `exclude` es la venta que se está marcando: re-marcarla con el mismo número no choca.
 */
export function assertInvoiceNumberFree(
  number: string,
  orders: ReadonlyArray<{ id: string; invoice?: SaleInvoice }>,
  retailSales: ReadonlyArray<{ id: string; invoice?: SaleInvoice }>,
  exclude: { orderId?: string; retailSaleId?: string } = {},
): void {
  const usedByOrder = orders.some(
    (o) => o.id !== exclude.orderId && o.invoice?.number === number,
  );
  const usedByRetail = retailSales.some(
    (s) => s.id !== exclude.retailSaleId && s.invoice?.number === number,
  );
  if (usedByOrder || usedByRetail) {
    throw new BadRequestException(
      `La factura ${number} ya está asignada a otra venta`,
    );
  }
}
