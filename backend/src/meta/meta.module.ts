import { Module } from '@nestjs/common';
import { ChatsModule } from '../chats/chats.module';
import { OrdersModule } from '../orders/orders.module';
import { QuotesModule } from '../quotes/quotes.module';
import { StoreModule } from '../store/store.module';
import { MetaController } from './meta.controller';
import { MetaGraphClient } from './meta-graph.client';
import { MetaInboundEvents } from './meta-inbound.events';
import { MetaTemplatesService } from './meta-templates.service';
import { MetaWebhookController } from './meta-webhook.controller';
import { MetaWebhookService } from './meta-webhook.service';

@Module({
  imports: [ChatsModule, StoreModule, OrdersModule, QuotesModule],
  controllers: [MetaWebhookController, MetaController],
  providers: [
    MetaGraphClient,
    MetaInboundEvents,
    MetaWebhookService,
    MetaTemplatesService,
  ],
  exports: [MetaInboundEvents, MetaGraphClient],
})
export class MetaModule {}
