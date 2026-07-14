import { Injectable } from '@nestjs/common';
import { RetailSale } from '../../common/interfaces';
import { StoreService } from '../store.service';

@Injectable()
export class RetailSaleRepository {
  constructor(private readonly store: StoreService) {}

  findAll(): RetailSale[] {
    return this.store.retailSales;
  }

  findById(id: string): RetailSale | undefined {
    return this.store.getRetailSaleById(id);
  }

  nextId(): string {
    return this.store.nextRetailSaleId();
  }

  create(sale: RetailSale): RetailSale {
    this.store.retailSales.push(sale);
    this.store.indexRetailSale(sale);
    return sale;
  }

  save(sale: RetailSale): RetailSale {
    this.store.replaceRetailSale(sale);
    return sale;
  }

  remove(id: string): boolean {
    return this.store.removeRetailSale(id);
  }
}
