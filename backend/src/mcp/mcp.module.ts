import { Module } from '@nestjs/common';
import { AgentApprovalsModule } from '../agent-approvals/agent-approvals.module';
import { OrdersModule } from '../orders/orders.module';
import { PrintJobsModule } from '../print-jobs/print-jobs.module';
import { QuotesModule } from '../quotes/quotes.module';
import { SettingsModule } from '../settings/settings.module';
import { McpController } from './mcp.controller';
import { McpToolsService } from './mcp-tools.service';

@Module({
  imports: [
    PrintJobsModule,
    QuotesModule,
    OrdersModule,
    SettingsModule,
    AgentApprovalsModule,
  ],
  controllers: [McpController],
  providers: [McpToolsService],
})
export class McpModule {}
