import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  IntegrationsSettings,
  SaleInvoice,
  WhatsAppTemplate,
} from '../common/interfaces';

export const MAX_FEE_PERCENT = 99.99;
const TEMPLATE_NAME_MAX = 80;
const TEMPLATE_BODY_MAX = 2000;
const TEMPLATE_ID_MAX = 64;
const PHONE_MAX = 32;

/** Plantillas por defecto (§28.1). Sin horario de retiro. */
export const DEFAULT_WHATSAPP_TEMPLATES: readonly WhatsAppTemplate[] = [
  {
    id: 'tpl-presupuesto',
    name: 'Presupuesto enviado',
    body:
      'Hola {cliente}, te paso el presupuesto {pedido}:\n{items}\n\nTotal: {total}.\n' +
      '¿Lo confirmamos? Cualquier duda, avisame.',
    builtIn: true,
  },
  {
    id: 'tpl-diseno',
    name: 'Diseño para aprobar',
    body:
      'Hola {cliente}, te mando el diseño de tu pedido {pedido} para que lo revises.\n' +
      'Si está todo bien, avisame y seguimos con la producción.',
    builtIn: true,
  },
  {
    id: 'tpl-listo',
    name: 'Tu pedido está listo',
    body:
      'Hola {cliente}, tu pedido {pedido} está listo.\n{items}\n' +
      'Saldo a abonar: {saldo}. Avisame cuándo pasás a retirarlo.',
    builtIn: true,
  },
  {
    id: 'tpl-saldo',
    name: 'Recordatorio de saldo',
    body:
      'Hola {cliente}, te recuerdo que tu pedido {pedido} tiene un saldo pendiente de {saldo} ' +
      '(total {total}, pagado {pagado}). ¡Gracias!',
    builtIn: true,
  },
];

const BUILT_IN_IDS = new Set(DEFAULT_WHATSAPP_TEMPLATES.map((t) => t.id));

function cloneDefaultTemplates(): WhatsAppTemplate[] {
  return DEFAULT_WHATSAPP_TEMPLATES.map((t) => ({ ...t }));
}

export function defaultIntegrations(): IntegrationsSettings {
  return {
    mercadoPago: { feePercent: 0 },
    arca: { pointOfSale: null, annualCap: null },
    whatsapp: { businessPhone: '', templates: cloneDefaultTemplates() },
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

function normalizeTemplates(raw: unknown): WhatsAppTemplate[] {
  if (!Array.isArray(raw)) return cloneDefaultTemplates();
  const seen = new Set<string>();
  const result: WhatsAppTemplate[] = [];
  for (const item of raw) {
    const rec = asRecord(item);
    const name = typeof rec.name === 'string' ? rec.name.trim() : '';
    const body = typeof rec.body === 'string' ? rec.body.trim() : '';
    if (!name || !body) continue;
    let id =
      typeof rec.id === 'string' && rec.id.trim()
        ? rec.id.trim().slice(0, TEMPLATE_ID_MAX)
        : '';
    if (!id || seen.has(id)) id = `tpl-${randomUUID().slice(0, 8)}`;
    seen.add(id);
    result.push({
      id,
      name: name.slice(0, TEMPLATE_NAME_MAX),
      body: body.slice(0, TEMPLATE_BODY_MAX),
      builtIn: BUILT_IN_IDS.has(id),
    });
  }
  // Las plantillas por defecto no se borran: si faltan, se reponen al principio.
  const missing = DEFAULT_WHATSAPP_TEMPLATES.filter((t) => !seen.has(t.id)).map(
    (t) => ({ ...t }),
  );
  return [...missing, ...result];
}

/** Lee `integrations` desde la base o un cliente; tolera nulo y datos viejos. */
export function normalizeIntegrations(raw: unknown): IntegrationsSettings {
  const rec = asRecord(raw);
  const mp = asRecord(rec.mercadoPago);
  const arca = asRecord(rec.arca);
  const wa = asRecord(rec.whatsapp);
  return {
    mercadoPago: { feePercent: normalizeFeePercent(mp.feePercent) },
    arca: {
      pointOfSale: normalizePointOfSale(arca.pointOfSale),
      annualCap: normalizeAnnualCap(arca.annualCap),
    },
    whatsapp: {
      businessPhone:
        typeof wa.businessPhone === 'string'
          ? wa.businessPhone.trim().slice(0, PHONE_MAX)
          : '',
      templates: normalizeTemplates(wa.templates),
    },
  };
}

export interface IntegrationsPatch {
  mercadoPago?: { feePercent?: number };
  arca?: { pointOfSale?: number | null; annualCap?: number | null };
  whatsapp?: {
    businessPhone?: string;
    templates?: Array<{ id?: string; name: string; body: string }>;
  };
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

  if (patch.whatsapp?.businessPhone !== undefined) {
    base.whatsapp.businessPhone = String(patch.whatsapp.businessPhone)
      .trim()
      .slice(0, PHONE_MAX);
  }
  if (patch.whatsapp?.templates !== undefined) {
    for (const t of patch.whatsapp.templates) {
      if (!t.name?.trim() || !t.body?.trim()) {
        throw new BadRequestException(
          'Cada plantilla necesita nombre y mensaje',
        );
      }
    }
    base.whatsapp.templates = normalizeTemplates(patch.whatsapp.templates);
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
