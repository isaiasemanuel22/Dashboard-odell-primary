import { Prisma } from '@prisma/client';
import {
  ChatAuthor,
  ChatChannel,
  ChatDirection,
  ChatMessageStatus,
} from '../../common/enums';
import { ChatConversation, ChatMessage } from '../../common/interfaces';
import { fromJson, toInputJson } from '../../prisma/json.util';
import { normalizeProductAttachments } from '../../products/product-attachment.util';

function normalizeEnum<T extends string>(
  values: Record<string, T>,
  value: string,
  fallback: T,
): T {
  return Object.values(values).includes(value as T) ? (value as T) : fallback;
}

export function mapChatConversationFromDb(row: {
  id: string;
  channel: string;
  externalId: string;
  displayName: string | null;
  displayPhone: string | null;
  customerId: string | null;
  handedOff: boolean;
  agentPaused: boolean;
  lastReadAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): ChatConversation {
  return {
    id: row.id,
    channel: normalizeEnum(ChatChannel, row.channel, ChatChannel.WHATSAPP),
    externalId: row.externalId,
    displayName: row.displayName,
    displayPhone: row.displayPhone,
    customerId: row.customerId,
    handedOff: row.handedOff,
    agentPaused: row.agentPaused,
    lastReadAt: row.lastReadAt ? row.lastReadAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapChatConversationToDb(conversation: ChatConversation) {
  return {
    id: conversation.id,
    channel: conversation.channel,
    externalId: conversation.externalId,
    displayName: conversation.displayName,
    displayPhone: conversation.displayPhone,
    customerId: conversation.customerId,
    handedOff: conversation.handedOff,
    agentPaused: conversation.agentPaused,
    lastReadAt: conversation.lastReadAt
      ? new Date(conversation.lastReadAt)
      : null,
    createdAt: new Date(conversation.createdAt),
    updatedAt: new Date(conversation.updatedAt),
  };
}

export function mapChatMessageFromDb(row: {
  id: string;
  conversationId: string;
  direction: string;
  author: string;
  authorUserId: string | null;
  text: string;
  attachments: Prisma.JsonValue;
  status: string;
  externalMessageId: string | null;
  quoteId: string | null;
  sentAt: Date;
  updatedAt: Date;
}): ChatMessage {
  return {
    id: row.id,
    conversationId: row.conversationId,
    direction: normalizeEnum(ChatDirection, row.direction, ChatDirection.IN),
    author: normalizeEnum(ChatAuthor, row.author, ChatAuthor.CUSTOMER),
    authorUserId: row.authorUserId,
    text: row.text,
    attachments: normalizeProductAttachments(fromJson(row.attachments ?? [])),
    status: normalizeEnum(
      ChatMessageStatus,
      row.status,
      ChatMessageStatus.RECEIVED,
    ),
    externalMessageId: row.externalMessageId,
    quoteId: row.quoteId,
    sentAt: row.sentAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapChatMessageToDb(message: ChatMessage) {
  return {
    id: message.id,
    conversationId: message.conversationId,
    direction: message.direction,
    author: message.author,
    authorUserId: message.authorUserId,
    text: message.text,
    attachments: toInputJson(message.attachments ?? []),
    status: message.status,
    externalMessageId: message.externalMessageId,
    quoteId: message.quoteId,
    sentAt: new Date(message.sentAt),
    updatedAt: new Date(message.updatedAt),
  };
}
