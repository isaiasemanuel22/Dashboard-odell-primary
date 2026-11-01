import { CustomerSource, CustomerType } from '../../common/enums';
import { Customer } from '../../common/interfaces';

const CUSTOMER_TYPES = new Set<string>(Object.values(CustomerType));
const CUSTOMER_SOURCES = new Set<string>(Object.values(CustomerSource));

function parseCustomerType(value: string | null | undefined): CustomerType {
  if (value && CUSTOMER_TYPES.has(value)) {
    return value as CustomerType;
  }
  return CustomerType.PARTICULAR;
}

function parseCustomerSource(
  value: string | null | undefined,
): CustomerSource | undefined {
  if (value && CUSTOMER_SOURCES.has(value)) {
    return value as CustomerSource;
  }
  return undefined;
}

export function mapCustomerFromDb(row: {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string | null;
  type?: string | null;
  wholesaleMinimum?: number | null;
  taxId?: string | null;
  source?: string | null;
  createdAt: Date;
}): Customer {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    company: row.company ?? undefined,
    type: parseCustomerType(row.type),
    wholesaleMinimum: row.wholesaleMinimum ?? undefined,
    taxId: row.taxId ?? undefined,
    source: parseCustomerSource(row.source),
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
    type: customer.type,
    wholesaleMinimum: customer.wholesaleMinimum ?? null,
    taxId: customer.taxId ?? null,
    source: customer.source ?? null,
    createdAt: new Date(customer.createdAt),
  };
}
