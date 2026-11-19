import { Injectable } from '@nestjs/common';
import { ChatChannel } from '../../common/enums';
import { ChatConversation, ChatMessage } from '../../common/interfaces';
import { StoreService } from '../store.service';
import { replaceInCollection } from '../store-collection.util';

@Injectable()
export class ChatRepository {
  constructor(private readonly store: StoreService) {}

  findAllConversations(): ChatConversation[] {
    return this.store.chatConversations;
  }

  findConversationById(id: string): ChatConversation | undefined {
    return this.store.chatConversations.find((chat) => chat.id === id);
  }

  findConversationByExternalId(
    channel: ChatChannel,
    externalId: string,
  ): ChatConversation | undefined {
    return this.store.chatConversations.find(
      (chat) => chat.channel === channel && chat.externalId === externalId,
    );
  }

  createConversation(conversation: ChatConversation): ChatConversation {
    this.store.chatConversations.push(conversation);
    return conversation;
  }

  saveConversation(conversation: ChatConversation): ChatConversation {
    replaceInCollection(
      this.store.chatConversations,
      conversation.id,
      conversation,
    );
    return conversation;
  }

  nextConversationId(): string {
    return this.store.nextChatId();
  }

  findAllMessages(): ChatMessage[] {
    return this.store.chatMessages;
  }

  findMessageById(id: string): ChatMessage | undefined {
    return this.store.chatMessages.find((message) => message.id === id);
  }

  createMessage(message: ChatMessage): ChatMessage {
    this.store.chatMessages.push(message);
    return message;
  }

  saveMessage(message: ChatMessage): ChatMessage {
    replaceInCollection(this.store.chatMessages, message.id, message);
    return message;
  }

  nextMessageId(): string {
    return this.store.nextChatMessageId();
  }
}
