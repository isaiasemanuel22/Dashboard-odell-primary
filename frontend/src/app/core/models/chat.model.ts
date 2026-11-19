import type { Customer, ProductAttachment } from './index';

export type ChatChannel = 'whatsapp' | 'instagram' | 'messenger';

export type ChatStatus = 'open' | 'pending_approval' | 'handed_off';

export type ChatFilter = 'unread' | 'pending_approval' | 'handed_off';

export type ChatMessageDirection = 'in' | 'out';

export type ChatMessageAuthor = 'customer' | 'agent' | 'human';

export type ChatMessageStatus =
  | 'received'
  | 'sent'
  | 'failed'
  | 'suggested'
  | 'discarded';

/** Lo derivado (estado, no leídos, ventana) lo calcula el backend. */
export interface ChatSummary {
  id: string;
  channel: ChatChannel;
  externalId: string;
  displayName: string | null;
  displayPhone: string | null;
  contactName: string | null;
  customerId: string | null;
  status: ChatStatus;
  unreadCount: number;
  pendingSuggestions: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  lastMessageDirection: ChatMessageDirection | null;
  lastInboundAt: string | null;
  windowOpen: boolean;
  windowExpiresAt: string | null;
  /** En true cuando un humano escribió o se derivó el chat. */
  agentPaused: boolean;
}

export interface ChatCounts {
  all: number;
  unread: number;
  pendingApproval: number;
  handedOff: number;
  byChannel: Record<ChatChannel, number>;
}

export interface ChatList {
  conversations: ChatSummary[];
  counts: ChatCounts;
}

export interface ChatListQuery {
  channel?: ChatChannel | null;
  filter?: ChatFilter | null;
  search?: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  direction: ChatMessageDirection;
  author: ChatMessageAuthor;
  authorUserId: string | null;
  text: string;
  attachments: ProductAttachment[];
  status: ChatMessageStatus;
  externalMessageId: string | null;
  quoteId: string | null;
  sentAt: string;
  updatedAt: string;
}

export interface ChatSuggestionQuote {
  id: string;
  status: string;
  total: number;
  items: { productName: string; quantity: number; unitPrice: number }[];
}

export interface ChatCustomerContext {
  lastOrder: { id: string; total: number; createdAt: string } | null;
  openQuotes: { id: string; status: string; total: number }[];
}

export interface ChatDetail {
  conversation: ChatSummary;
  messages: ChatMessage[];
  suggestionQuotes: Record<string, ChatSuggestionQuote>;
  customer: Customer | null;
  customerContext: ChatCustomerContext | null;
}

export interface SendChatMessagePayload {
  text: string;
  attachments?: ProductAttachment[];
}
