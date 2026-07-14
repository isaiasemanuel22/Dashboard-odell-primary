import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';
import { CategoriesModule } from './categories/categories.module';
import { CustomersModule } from './customers/customers.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ImpresosModule } from './impresos/impresos.module';
import { MaterialsModule } from './materials/materials.module';
import { OrdersModule } from './orders/orders.module';
import { PrintJobsModule } from './print-jobs/print-jobs.module';
import { ProductsModule } from './products/products.module';
import { SalesModule } from './sales/sales.module';
import { SettingsModule } from './settings/settings.module';
import { StoreModule } from './store/store.module';
import { SuppliesModule } from './supplies/supplies.module';
import { UploadModule } from './upload/upload.module';
import { RealtimeModule } from './realtime/realtime.module';
import { ReferenceDataModule } from './reference-data/reference-data.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    AuthModule,
    HealthModule,
    StoreModule,
    RealtimeModule,
    ReferenceDataModule,
    DashboardModule,
    ProductsModule,
    CategoriesModule,
    SettingsModule,
    SuppliesModule,
    ImpresosModule,
    UploadModule,
    CustomersModule,
    OrdersModule,
    PrintJobsModule,
    MaterialsModule,
    SalesModule,
  ],
})
export class AppModule {}
