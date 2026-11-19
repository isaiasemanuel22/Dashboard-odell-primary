import { Module } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { MetaChannelGateway } from '../meta/meta-channel.gateway';
import { MetaGraphClient } from '../meta/meta-graph.client';
import { StoreModule } from '../store/store.module';
import { CHANNEL_GATEWAY } from './channel-gateway';
import { ChatsController } from './chats.controller';
import { ChatsService } from './chats.service';

@Module({
  imports: [StoreModule],
  controllers: [ChatsController],
  providers: [
    ChatsService,
    {
      provide: CHANNEL_GATEWAY,
      useFactory: (config: AppConfigService) =>
        new MetaChannelGateway(new MetaGraphClient(config), config),
      inject: [AppConfigService],
    },
  ],
  exports: [ChatsService, CHANNEL_GATEWAY],
})
export class ChatsModule {}
