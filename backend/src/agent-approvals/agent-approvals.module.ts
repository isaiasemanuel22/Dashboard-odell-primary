import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { OrdersModule } from '../orders/orders.module';
import { QuotesModule } from '../quotes/quotes.module';
import { AgentApprovalsController } from './agent-approvals.controller';
import { AgentApprovalsService } from './agent-approvals.service';

@Module({
  imports: [OrdersModule, QuotesModule, AlertsModule],
  controllers: [AgentApprovalsController],
  providers: [AgentApprovalsService],
  exports: [AgentApprovalsService],
})
export class AgentApprovalsModule {}
