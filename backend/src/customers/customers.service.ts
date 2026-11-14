import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { CustomerSource, CustomerType } from '../common/enums';
import { Customer } from '../common/interfaces';
import { assertValidEmail } from '../common/validators/domain.validators';
import { CustomerRepository } from '../store/repositories/customer.repository';

function normalizeTaxId(taxId: string | undefined): string | undefined {
  if (taxId === undefined) return undefined;
  const trimmed = taxId.trim();
  if (!trimmed) return undefined;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length !== 11) {
    throw new BadRequestException('El CUIT tiene que tener 11 dígitos');
  }
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
}

function resolveWholesaleMinimum(
  type: CustomerType,
  wholesaleMinimum: number | undefined,
): number | undefined {
  if (type !== CustomerType.REVENDEDOR) return undefined;
  return wholesaleMinimum;
}

@Injectable()
export class CustomersService {
  constructor(private readonly customers: CustomerRepository) {}

  findAll(): Customer[] {
    return this.customers.findAll();
  }

  findOne(id: string): Customer {
    const customer = this.customers.findById(id);
    if (!customer) {
      throw new NotFoundException(`Cliente ${id} no encontrado`);
    }
    return customer;
  }

  create(data: {
    name: string;
    email?: string;
    phone: string;
    company?: string;
    type?: CustomerType;
    wholesaleMinimum?: number;
    taxId?: string;
    source?: CustomerSource;
  }): Customer {
    const name = data.name?.trim();
    const email = data.email?.trim() ?? '';
    const phone = data.phone?.trim();
    if (!name || !phone) {
      throw new BadRequestException('Nombre y teléfono son obligatorios');
    }
    if (email) {
      assertValidEmail(email);
      if (this.customers.emailExists(email)) {
        throw new ConflictException('Ya existe un cliente con ese email');
      }
    }

    const type = data.type ?? CustomerType.PARTICULAR;
    return this.customers.create({
      name,
      email,
      phone,
      company: data.company?.trim() || undefined,
      type,
      wholesaleMinimum: resolveWholesaleMinimum(type, data.wholesaleMinimum),
      taxId: normalizeTaxId(data.taxId),
      source: data.source,
    });
  }

  update(id: string, data: Partial<Omit<Customer, 'id'>>): Customer {
    const current = this.customers.findById(id);
    if (!current) {
      throw new NotFoundException(`Cliente ${id} no encontrado`);
    }

    const type = data.type ?? current.type;
    const wholesaleMinimum =
      type === CustomerType.REVENDEDOR
        ? data.wholesaleMinimum !== undefined
          ? data.wholesaleMinimum
          : current.wholesaleMinimum
        : undefined;

    const updated: Customer = {
      ...current,
      ...data,
      name: data.name !== undefined ? data.name.trim() : current.name,
      email: data.email !== undefined ? data.email.trim() : current.email,
      phone: data.phone !== undefined ? data.phone.trim() : current.phone,
      company:
        data.company !== undefined
          ? data.company.trim() || undefined
          : current.company,
      type,
      wholesaleMinimum,
      taxId:
        data.taxId !== undefined ? normalizeTaxId(data.taxId) : current.taxId,
      source: data.source !== undefined ? data.source : current.source,
    };

    if (!updated.name || !updated.phone) {
      throw new BadRequestException('Nombre y teléfono son obligatorios');
    }
    if (updated.email) {
      assertValidEmail(updated.email);
      if (this.customers.emailExists(updated.email, id)) {
        throw new ConflictException('Ya existe un cliente con ese email');
      }
    }

    return this.customers.save(updated);
  }

  remove(id: string): void {
    if (!this.customers.findById(id)) {
      throw new NotFoundException(`Cliente ${id} no encontrado`);
    }
    if (this.customers.hasOrders(id)) {
      throw new ConflictException(
        'No se puede eliminar un cliente con pedidos asociados',
      );
    }
    this.customers.remove(id);
  }
}
