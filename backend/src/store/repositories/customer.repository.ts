import { Injectable } from '@nestjs/common';
import { Customer } from '../../common/interfaces';
import { StoreService } from '../store.service';

@Injectable()
export class CustomerRepository {
  constructor(private readonly store: StoreService) {}

  findAll(): Customer[] {
    return this.store.customers;
  }

  findById(id: string): Customer | undefined {
    return this.store.getCustomerById(id);
  }

  create(data: Omit<Customer, 'id' | 'createdAt'>): Customer {
    const customer: Customer = {
      id: this.store.nextId('cust', this.store.customers),
      createdAt: new Date().toISOString(),
      ...data,
    };
    this.store.customers.push(customer);
    this.store.indexCustomer(customer);
    return customer;
  }

  save(customer: Customer): Customer {
    const index = this.store.customers.findIndex((item) => item.id === customer.id);
    if (index === -1) {
      this.store.customers.push(customer);
    } else {
      this.store.customers[index] = customer;
    }
    this.store.indexCustomer(customer);
    return customer;
  }

  remove(id: string): boolean {
    return this.store.removeCustomer(id);
  }

  hasOrders(customerId: string): boolean {
    return this.store.orders.some((order) => order.customerId === customerId);
  }

  emailExists(email: string, excludeId?: string): boolean {
    const normalized = email.toLowerCase();
    return this.store.customers.some(
      (customer) =>
        customer.email.toLowerCase() === normalized &&
        customer.id !== excludeId,
    );
  }
}
