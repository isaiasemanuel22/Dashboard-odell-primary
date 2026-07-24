import { Module } from '@nestjs/common';
import { PricingModule } from '../pricing/pricing.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [PricingModule],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
