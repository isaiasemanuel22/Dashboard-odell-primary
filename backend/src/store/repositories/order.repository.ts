import { Injectable } from '@nestjs/common';
import { Order } from '../../common/interfaces';
import { StoreService } from '../store.service';

@Injectable()
export class OrderRepository {
  constructor(private readonly store: StoreService) {}

  findAll(): Order[] {
    return this.store.orders;
  }

  findById(id: string): Order | undefined {
    return this.store.getOrderById(id);
  }

  nextId(): string {
    return this.store.nextOrderId();
  }

  create(order: Order): Order {
    this.store.orders.push(order);
    this.store.indexOrder(order);
    return order;
  }

  save(order: Order): Order {
    this.store.replaceOrder(order);
    return order;
  }

  remove(id: string): boolean {
    return this.store.removeOrder(id);
  }
}
