import { BadRequestException } from '@nestjs/common';
import { CustomerType } from '../common/enums';
import { CustomerRepository } from '../store/repositories/customer.repository';
import { StoreService } from '../store/store.service';
import { CustomersService } from './customers.service';

describe('CustomersService', () => {
  function setup() {
    const store = new StoreService();
    const repository = new CustomerRepository(store);
    const service = new CustomersService(repository);
    return { store, service };
  }

  describe('remove', () => {
    it('usa el índice del store al eliminar', () => {
      const { store, service } = setup();

      store.customers.push({
        id: 'cust-1',
        name: 'Test',
        email: 'test@test.com',
        phone: '123',
        type: CustomerType.PARTICULAR,
        createdAt: '2026-07-01T10:00:00.000Z',
      });
      store.indexCustomer(store.customers[0]);

      service.remove('cust-1');

      expect(store.getCustomerById('cust-1')).toBeUndefined();
      expect(store.customers).toHaveLength(0);
    });
  });

  describe('create / update — tipo, mínimo y CUIT', () => {
    it('usa particular por defecto si no se envía type', () => {
      const { service } = setup();

      const customer = service.create({
        name: 'Ana',
        email: 'ana@test.com',
        phone: '111',
      });

      expect(customer.type).toBe(CustomerType.PARTICULAR);
      expect(customer.wholesaleMinimum).toBeUndefined();
    });

    it('revendedor guarda el mínimo mayorista', () => {
      const { service } = setup();

      const customer = service.create({
        name: 'Mayorista',
        email: 'mayorista@test.com',
        phone: '222',
        type: CustomerType.REVENDEDOR,
        wholesaleMinimum: 50000,
      });

      expect(customer.type).toBe(CustomerType.REVENDEDOR);
      expect(customer.wholesaleMinimum).toBe(50000);
    });

    it('no revendedor descarta el mínimo mayorista', () => {
      const { service } = setup();

      const customer = service.create({
        name: 'Empresa SA',
        email: 'empresa@test.com',
        phone: '333',
        type: CustomerType.EMPRESA,
        wholesaleMinimum: 50000,
      });

      expect(customer.type).toBe(CustomerType.EMPRESA);
      expect(customer.wholesaleMinimum).toBeUndefined();

      const updated = service.update(customer.id, {
        type: CustomerType.PARTICULAR,
        wholesaleMinimum: 10000,
      });
      expect(updated.wholesaleMinimum).toBeUndefined();
    });

    it('CUIT válido se normaliza a XX-XXXXXXXX-X', () => {
      const { service } = setup();

      const customer = service.create({
        name: 'Con CUIT',
        email: 'cuit@test.com',
        phone: '444',
        taxId: '20123456789',
      });

      expect(customer.taxId).toBe('20-12345678-9');

      const withHyphens = service.create({
        name: 'Con CUIT guiones',
        email: 'cuit2@test.com',
        phone: '555',
        taxId: '20-12345678-9',
      });
      expect(withHyphens.taxId).toBe('20-12345678-9');
    });

    it('CUIT inválido falla', () => {
      const { service } = setup();

      expect(() =>
        service.create({
          name: 'CUIT malo',
          email: 'malo@test.com',
          phone: '666',
          taxId: '12345',
        }),
      ).toThrow(BadRequestException);

      try {
        service.create({
          name: 'CUIT malo 2',
          email: 'malo2@test.com',
          phone: '777',
          taxId: '1234567890',
        });
        fail('debería haber fallado');
      } catch (err) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect((err as BadRequestException).message).toBe(
          'El CUIT tiene que tener 11 dígitos',
        );
      }
    });
  });
});
