import { CustomerRepository } from '../store/repositories/customer.repository';
import { StoreService } from '../store/store.service';
import { CustomersService } from './customers.service';

describe('CustomersService.remove', () => {
  it('usa el índice del store al eliminar', () => {
    const store = new StoreService();
    const repository = new CustomerRepository(store);
    const service = new CustomersService(repository);

    store.customers.push({
      id: 'cust-1',
      name: 'Test',
      email: 'test@test.com',
      phone: '123',
      createdAt: '2026-07-01T10:00:00.000Z',
    });
    store.indexCustomer(store.customers[0]!);

    service.remove('cust-1');

    expect(store.getCustomerById('cust-1')).toBeUndefined();
    expect(store.customers).toHaveLength(0);
  });
});
