import { forwardRef, Global, Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import {
  CategoryRepository,
  CustomerRepository,
  MaterialRepository,
  OrderRepository,
  ProductRepository,
  RetailSaleRepository,
  SupplyRepository,
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
    ProductRepository,
    RetailSaleRepository,
    CategoryRepository,
    SupplyRepository,
    MaterialRepository,
  ],
  exports: [
    StoreService,
    StorePersistenceService,
    StoreChangeService,
    CustomerRepository,
    OrderRepository,
    ProductRepository,
    RetailSaleRepository,
    CategoryRepository,
    SupplyRepository,
    MaterialRepository,
  ],
})
export class StoreModule {}
