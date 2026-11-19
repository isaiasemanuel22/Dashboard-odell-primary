import { Module } from '@nestjs/common';
import { StoreModule } from '../store/store.module';
import { CHANNEL_GATEWAY } from './channel-gateway';
import { ChatsController } from './chats.controller';
import { ChatsService } from './chats.service';
import { LocalChannelGateway } from './local-channel-gateway';

@Module({
  imports: [StoreModule],
  controllers: [ChatsController],
  providers: [
    ChatsService,
    { provide: CHANNEL_GATEWAY, useClass: LocalChannelGateway },
  ],
  exports: [ChatsService, CHANNEL_GATEWAY],
})
export class ChatsModule {}
