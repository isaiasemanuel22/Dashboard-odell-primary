import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';

@Module({
  imports: [OrdersModule],
  controllers: [QuotesController],
  providers: [QuotesService],
})
export class QuotesModule {}
