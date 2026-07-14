import { Customer } from '../../common/interfaces';

export function mapCustomerFromDb(row: {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string | null;
  createdAt: Date;
}): Customer {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    company: row.company ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

export function mapCustomerToDb(customer: Customer) {
  return {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    company: customer.company ?? null,
    createdAt: new Date(customer.createdAt),
  };
}
