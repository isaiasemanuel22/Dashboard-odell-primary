import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';
import { BrandsModule } from './brands/brands.module';
import { CategoriesModule } from './categories/categories.module';
import { CustomersModule } from './customers/customers.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ImpresosModule } from './impresos/impresos.module';
import { OrdersModule } from './orders/orders.module';
import { QuotesModule } from './quotes/quotes.module';
import { CalendarModule } from './calendar/calendar.module';
import { PrintJobsModule } from './print-jobs/print-jobs.module';
import { ProductsModule } from './products/products.module';
import { SalesModule } from './sales/sales.module';
import { SettingsModule } from './settings/settings.module';
import { StoreModule } from './store/store.module';
import { SuppliesModule } from './supplies/supplies.module';
import { TreasuryModule } from './treasury/treasury.module';
import { UploadModule } from './upload/upload.module';
import { RealtimeModule } from './realtime/realtime.module';
import { ReferenceDataModule } from './reference-data/reference-data.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    AuthModule,
    UsersModule,
    HealthModule,
    StoreModule,
    RealtimeModule,
    ReferenceDataModule,
    DashboardModule,
    ProductsModule,
    BrandsModule,
    CategoriesModule,
    SettingsModule,
    SuppliesModule,
    ImpresosModule,
    UploadModule,
    CustomersModule,
    OrdersModule,
    QuotesModule,
    CalendarModule,
    PrintJobsModule,
    SalesModule,
    TreasuryModule,
  ],
})
export class AppModule {}
