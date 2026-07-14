import {
  mapCustomerFromDb,
  mapCustomerToDb,
} from './customer.mapper';

describe('customer.mapper', () => {
  it('hace round-trip de cliente', () => {
    const createdAt = new Date('2026-07-01T10:00:00.000Z');
    const fromDb = mapCustomerFromDb({
      id: 'cust-1',
      name: 'María',
      email: 'maria@test.com',
      phone: '123',
      company: 'Acme',
      createdAt,
    });

    expect(fromDb).toEqual({
      id: 'cust-1',
      name: 'María',
      email: 'maria@test.com',
      phone: '123',
      company: 'Acme',
      createdAt: createdAt.toISOString(),
    });

    const toDb = mapCustomerToDb(fromDb);
    expect(toDb.id).toBe('cust-1');
    expect(toDb.company).toBe('Acme');
    expect(toDb.createdAt).toEqual(createdAt);
  });
});
