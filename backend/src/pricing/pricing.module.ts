import { forwardRef, Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { ProductPricingService } from '../products/product-pricing.service';
import { PricingSyncService } from './pricing-sync.service';

@Module({
  imports: [forwardRef(() => SettingsModule)],
  providers: [ProductPricingService, PricingSyncService],
  exports: [ProductPricingService, PricingSyncService],
})
export class PricingModule {}
