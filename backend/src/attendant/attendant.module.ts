import Anthropic from '@anthropic-ai/sdk';
import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { ChatsModule } from '../chats/chats.module';
import { AppConfigService } from '../config/app-config.service';
import { CustomersModule } from '../customers/customers.module';
import { McpModule } from '../mcp/mcp.module';
import { MetaModule } from '../meta/meta.module';
import { OrdersModule } from '../orders/orders.module';
import { PrintJobsModule } from '../print-jobs/print-jobs.module';
import { QuotesModule } from '../quotes/quotes.module';
import { SettingsModule } from '../settings/settings.module';
import { StoreModule } from '../store/store.module';
import {
  AttendantController,
  AttendantSettingsController,
} from './attendant.controller';
import { ANTHROPIC_CLIENT, AttendantService } from './attendant.service';
import { AttendantTools } from './attendant-tools';
import { AttendantUsageService } from './attendant-usage.service';

@Module({
  imports: [
    MetaModule,
    ChatsModule,
    McpModule,
    AlertsModule,
    SettingsModule,
    QuotesModule,
    OrdersModule,
    CustomersModule,
    PrintJobsModule,
    StoreModule,
  ],
  controllers: [AttendantController, AttendantSettingsController],
  providers: [
    {
      provide: ANTHROPIC_CLIENT,
      useFactory: (config: AppConfigService) =>
        config.anthropicApiKey
          ? new Anthropic({ apiKey: config.anthropicApiKey })
          : null,
      inject: [AppConfigService],
    },
    AttendantTools,
    AttendantUsageService,
    AttendantService,
  ],
})
export class AttendantModule {}
