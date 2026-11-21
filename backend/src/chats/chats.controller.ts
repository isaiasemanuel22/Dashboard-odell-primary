import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApproveSuggestionDto,
  EditSuggestionDto,
  LinkChatCustomerDto,
  ListChatsQueryDto,
  SendChatMessageDto,
  SetChatAgentPausedDto,
} from '../common/dto';
import { ChatsService } from './chats.service';

@Controller('chats')
export class ChatsController {
  constructor(private readonly chatsService: ChatsService) {}

  @Get()
  list(@Query() query: ListChatsQueryDto) {
    return this.chatsService.list(query);
  }

  // Antes de ':id' para que 'unread-count' no se tome como un id.
  @Get('unread-count')
  unreadCount() {
    return this.chatsService.unreadCount();
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.chatsService.detail(id);
  }

  @Post(':id/messages')
  send(
    @Param('id') id: string,
    @Body() data: SendChatMessageDto,
    @Req() request: Request,
  ) {
    return this.chatsService.send(id, data, request.user?.uid);
  }

  @Post(':id/read')
  markRead(@Param('id') id: string) {
    return this.chatsService.markRead(id);
  }

  @Put(':id/customer')
  linkCustomer(@Param('id') id: string, @Body() data: LinkChatCustomerDto) {
    return this.chatsService.linkCustomer(id, data.customerId);
  }

  @Put(':id/agent-paused')
  setAgentPaused(@Param('id') id: string, @Body() data: SetChatAgentPausedDto) {
    return this.chatsService.setAgentPaused(id, data.paused);
  }

  @Delete(':id/customer')
  unlinkCustomer(@Param('id') id: string) {
    return this.chatsService.unlinkCustomer(id);
  }

  @Patch(':id/suggestions/:messageId')
  editSuggestion(
    @Param('id') id: string,
    @Param('messageId') messageId: string,
    @Body() data: EditSuggestionDto,
  ) {
    return this.chatsService.editSuggestion(id, messageId, data);
  }

  @Post(':id/suggestions/:messageId/approve')
  approveSuggestion(
    @Param('id') id: string,
    @Param('messageId') messageId: string,
    @Body() data: ApproveSuggestionDto,
    @Req() request: Request,
  ) {
    return this.chatsService.approveSuggestion(
      id,
      messageId,
      data,
      request.user?.uid,
    );
  }

  @Post(':id/suggestions/:messageId/discard')
  discardSuggestion(
    @Param('id') id: string,
    @Param('messageId') messageId: string,
  ) {
    return this.chatsService.discardSuggestion(id, messageId);
  }
}
