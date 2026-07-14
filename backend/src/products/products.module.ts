import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { ProductPricingService } from './product-pricing.service';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [SettingsModule],
  controllers: [ProductsController],
  providers: [ProductsService, ProductPricingService],
})
export class ProductsModule {}
