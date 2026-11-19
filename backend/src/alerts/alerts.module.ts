import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SettingsModule } from '../settings/settings.module';
import { SuppliesModule } from '../supplies/supplies.module';
import { AlertsController } from './alerts.controller';
import { AlertsNotifier } from './alerts-notifier';
import { AlertsScheduler } from './alerts.scheduler';
import { AlertsService } from './alerts.service';
import { LogWhatsAppSender } from './log-whatsapp.sender';
import { EMAIL_SENDER, WHATSAPP_SENDER } from './notification-sender';
import { ResendEmailSender } from './resend-email.sender';

@Module({
  imports: [ScheduleModule.forRoot(), SettingsModule, SuppliesModule],
  controllers: [AlertsController],
  providers: [
    { provide: WHATSAPP_SENDER, useClass: LogWhatsAppSender },
    { provide: EMAIL_SENDER, useClass: ResendEmailSender },
    AlertsNotifier,
    AlertsService,
    AlertsScheduler,
  ],
  exports: [AlertsNotifier],
})
export class AlertsModule {}
