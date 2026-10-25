import { forwardRef, Global, Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import {
  CategoryRepository,
  CustomerRepository,
  OrderRepository,
  ProductRepository,
  QuoteRepository,
  RetailSaleRepository,
  SupplyRepository,
  TreasuryExpenseRepository,
} from './repositories';
import { StoreChangeService } from './store-change.service';
import { StorePersistenceService } from './store-persistence.service';
import { StoreService } from './store.service';

@Global()
@Module({
  imports: [forwardRef(() => RealtimeModule)],
  providers: [
    StoreService,
    StorePersistenceService,
    StoreChangeService,
    CustomerRepository,
    OrderRepository,
    QuoteRepository,
    ProductRepository,
    RetailSaleRepository,
    CategoryRepository,
    SupplyRepository,
    TreasuryExpenseRepository,
  ],
  exports: [
    StoreService,
    StorePersistenceService,
    StoreChangeService,
    CustomerRepository,
    OrderRepository,
    QuoteRepository,
    ProductRepository,
    RetailSaleRepository,
    CategoryRepository,
    SupplyRepository,
    TreasuryExpenseRepository,
  ],
})
export class StoreModule {}
