import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppConfigService } from '../config/app-config.service';
import { MetaGraphClient } from '../meta/meta-graph.client';
import { SettingsModule } from '../settings/settings.module';
import { SuppliesModule } from '../supplies/supplies.module';
import { AlertsController } from './alerts.controller';
import { AlertsNotifier } from './alerts-notifier';
import { AlertsScheduler } from './alerts.scheduler';
import { AlertsService } from './alerts.service';
import { LogWhatsAppSender } from './log-whatsapp.sender';
import { MetaWhatsAppSender } from './meta-whatsapp.sender';
import { EMAIL_SENDER, WHATSAPP_SENDER } from './notification-sender';
import { ResendEmailSender } from './resend-email.sender';

@Module({
  imports: [ScheduleModule.forRoot(), SettingsModule, SuppliesModule],
  controllers: [AlertsController],
  providers: [
    MetaGraphClient,
    {
      provide: WHATSAPP_SENDER,
      useFactory: (config: AppConfigService, graph: MetaGraphClient) =>
        config.whatsappConfigured
          ? new MetaWhatsAppSender(config, graph)
          : new LogWhatsAppSender(),
      inject: [AppConfigService, MetaGraphClient],
    },
    { provide: EMAIL_SENDER, useClass: ResendEmailSender },
    AlertsNotifier,
    AlertsService,
    AlertsScheduler,
  ],
  exports: [AlertsNotifier],
})
export class AlertsModule {}
