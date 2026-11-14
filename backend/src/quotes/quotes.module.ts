import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { UsersModule } from '../users/users.module';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';

@Module({
  imports: [OrdersModule, UsersModule],
  controllers: [QuotesController],
  providers: [QuotesService],
})
export class QuotesModule {}
