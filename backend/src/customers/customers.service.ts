import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { Customer } from '../common/interfaces';
import { assertValidEmail } from '../common/validators/domain.validators';
import { CustomerRepository } from '../store/repositories/customer.repository';

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

  create(data: Omit<Customer, 'id' | 'createdAt'>): Customer {
    const name = data.name?.trim();
    const email = data.email?.trim();
    const phone = data.phone?.trim();
    if (!name || !email || !phone) {
      throw new BadRequestException('Nombre, email y teléfono son obligatorios');
    }
    assertValidEmail(email);
    if (this.customers.emailExists(email)) {
      throw new ConflictException('Ya existe un cliente con ese email');
    }

    return this.customers.create({
      name,
      email,
      phone,
      company: data.company?.trim() || undefined,
    });
  }

  update(id: string, data: Partial<Omit<Customer, 'id'>>): Customer {
    const current = this.customers.findById(id);
    if (!current) {
      throw new NotFoundException(`Cliente ${id} no encontrado`);
    }

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
    };

    if (!updated.name || !updated.email || !updated.phone) {
      throw new BadRequestException('Nombre, email y teléfono son obligatorios');
    }
    assertValidEmail(updated.email);
    if (this.customers.emailExists(updated.email, id)) {
      throw new ConflictException('Ya existe un cliente con ese email');
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
