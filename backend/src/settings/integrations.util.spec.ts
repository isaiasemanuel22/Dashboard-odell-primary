import { BadRequestException } from '@nestjs/common';
import {
  applyIntegrationsPatch,
  assertInvoiceNumberFree,
  buildSaleInvoice,
  DEFAULT_WHATSAPP_TEMPLATES,
  defaultIntegrations,
  invoiceFromColumns,
  invoiceToColumns,
  normalizeIntegrations,
  normalizeInvoiceNumber,
} from './integrations.util';

describe('integrations.util', () => {
  describe('normalizeIntegrations', () => {
    it('sin datos devuelve los valores por defecto con las 4 plantillas', () => {
      const result = normalizeIntegrations(undefined);
      expect(result.mercadoPago.feePercent).toBe(0);
      expect(result.arca).toEqual({ pointOfSale: null, annualCap: null });
      expect(result.whatsapp.businessPhone).toBe('');
      expect(result.whatsapp.templates.map((t) => t.id)).toEqual([
        'tpl-presupuesto',
        'tpl-diseno',
        'tpl-listo',
        'tpl-saldo',
      ]);
      expect(result.whatsapp.templates.every((t) => t.builtIn)).toBe(true);
    });

    it('tolera nulo y basura', () => {
      expect(normalizeIntegrations(null)).toEqual(defaultIntegrations());
      expect(normalizeIntegrations('x')).toEqual(defaultIntegrations());
    });

    it('limita la comisión y descarta valores inválidos', () => {
      expect(
        normalizeIntegrations({ mercadoPago: { feePercent: 150 } }).mercadoPago
          .feePercent,
      ).toBe(99.99);
      expect(
        normalizeIntegrations({ mercadoPago: { feePercent: -3 } }).mercadoPago
          .feePercent,
      ).toBe(0);
      expect(
        normalizeIntegrations({ arca: { pointOfSale: 0, annualCap: -1 } }).arca,
      ).toEqual({ pointOfSale: null, annualCap: null });
    });

    it('conserva plantillas guardadas, no repone si templates es un arreglo con las builtIn', () => {
      const saved = DEFAULT_WHATSAPP_TEMPLATES.map((t) => ({
        ...t,
        name: `${t.name} 2`,
      }));
      const result = normalizeIntegrations({ whatsapp: { templates: saved } });
      expect(result.whatsapp.templates[0].name).toBe('Presupuesto enviado 2');
      expect(result.whatsapp.templates).toHaveLength(4);
    });

    it('las plantillas por defecto ya no traen horario de retiro', () => {
      for (const t of DEFAULT_WHATSAPP_TEMPLATES) {
        expect(t.body.toLowerCase()).not.toContain('horario');
      }
    });
  });

  describe('applyIntegrationsPatch', () => {
    it('solo pisa lo enviado', () => {
      const current = normalizeIntegrations({
        mercadoPago: { feePercent: 5 },
        arca: { pointOfSale: 3, annualCap: 1000 },
      });
      const next = applyIntegrationsPatch(current, {
        arca: { annualCap: 2000 },
      });
      expect(next.mercadoPago.feePercent).toBe(5);
      expect(next.arca).toEqual({ pointOfSale: 3, annualCap: 2000 });
    });

    it('permite poner null en punto de venta y tope', () => {
      const current = normalizeIntegrations({
        arca: { pointOfSale: 3, annualCap: 1000 },
      });
      const next = applyIntegrationsPatch(current, {
        arca: { pointOfSale: null, annualCap: null },
      });
      expect(next.arca).toEqual({ pointOfSale: null, annualCap: null });
    });

    it('rechaza comisión fuera de 0–99,99', () => {
      expect(() =>
        applyIntegrationsPatch(undefined, { mercadoPago: { feePercent: 100 } }),
      ).toThrow(BadRequestException);
      expect(() =>
        applyIntegrationsPatch(undefined, { mercadoPago: { feePercent: -1 } }),
      ).toThrow(BadRequestException);
    });

    it('reemplaza la lista, genera ids y repone las builtIn que faltan', () => {
      const next = applyIntegrationsPatch(undefined, {
        whatsapp: {
          templates: [
            { id: 'tpl-listo', name: 'Listo!', body: 'Hola {cliente}' },
            { name: 'Nueva', body: 'Chau {cliente}' },
          ],
        },
      });
      const templates = next.whatsapp.templates;
      expect(templates).toHaveLength(5);
      expect(
        templates
          .filter((t) => t.builtIn)
          .map((t) => t.id)
          .sort(),
      ).toEqual(['tpl-diseno', 'tpl-listo', 'tpl-presupuesto', 'tpl-saldo']);
      expect(templates.find((t) => t.id === 'tpl-listo')?.name).toBe('Listo!');
      const created = templates.find((t) => t.name === 'Nueva')!;
      expect(created.builtIn).toBe(false);
      expect(created.id).toMatch(/^tpl-/);
    });

    it('el cliente no puede marcar builtIn una plantilla propia', () => {
      const next = applyIntegrationsPatch(undefined, {
        whatsapp: {
          templates: [
            {
              id: 'custom',
              name: 'X',
              body: 'Y',
              builtIn: true,
            } as never,
          ],
        },
      });
      expect(
        next.whatsapp.templates.find((t) => t.id === 'custom')?.builtIn,
      ).toBe(false);
    });

    it('rechaza plantilla sin nombre o sin mensaje', () => {
      expect(() =>
        applyIntegrationsPatch(undefined, {
          whatsapp: { templates: [{ name: ' ', body: 'x' }] },
        }),
      ).toThrow(BadRequestException);
    });
  });

  describe('factura', () => {
    it('rellena el número a 4-8 dígitos', () => {
      expect(normalizeInvoiceNumber('3-41')).toBe('0003-00000041');
      expect(normalizeInvoiceNumber('0003-00000041')).toBe('0003-00000041');
    });

    it('rechaza formatos inválidos y ceros', () => {
      for (const bad of [
        '',
        'abc',
        '123456-1',
        '1-123456789',
        '0-5',
        '5-0',
        '1_2',
      ]) {
        expect(() => normalizeInvoiceNumber(bad)).toThrow(BadRequestException);
      }
    });

    it('buildSaleInvoice usa factura C y la fecha indicada', () => {
      const invoice = buildSaleInvoice('3-41', '2026-11-10T15:00:00.000Z');
      expect(invoice).toEqual({
        type: 'C',
        number: '0003-00000041',
        issuedAt: '2026-11-10T15:00:00.000Z',
      });
      expect(() => buildSaleInvoice('3-41', 'no-fecha')).toThrow(
        BadRequestException,
      );
    });

    it('detecta número repetido en pedidos y ventas, salvo la propia', () => {
      const invoice = buildSaleInvoice('3-41');
      const orders = [{ id: 'ord-1', invoice }];
      const sales = [{ id: 'sale-1', invoice: undefined }];
      expect(() =>
        assertInvoiceNumberFree(invoice.number, orders, sales),
      ).toThrow('ya está asignada');
      expect(() =>
        assertInvoiceNumberFree(invoice.number, orders, sales, {
          orderId: 'ord-1',
        }),
      ).not.toThrow();
      expect(() =>
        assertInvoiceNumberFree(invoice.number, [], [{ id: 's', invoice }]),
      ).toThrow('ya está asignada');
    });

    it('columnas de base: ida y vuelta, e incompletas dan undefined', () => {
      const invoice = buildSaleInvoice('3-41', '2026-11-10T15:00:00.000Z');
      expect(invoiceFromColumns(invoiceToColumns(invoice))).toEqual(invoice);
      expect(invoiceFromColumns(invoiceToColumns(undefined))).toBeUndefined();
      expect(
        invoiceFromColumns({ invoiceType: 'C', invoiceNumber: null }),
      ).toBeUndefined();
    });
  });
});
