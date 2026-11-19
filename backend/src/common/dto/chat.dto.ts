import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ChatChannel } from '../enums';
import { CUSTOMER_TEMPLATE_KEYS } from '../../meta/meta.constants';
import type { CustomerTemplateKey } from '../../meta/meta.constants';
import { MAX_DOCUMENT_ATTACHMENTS } from '../../products/product-attachment.util';
import { ProductAttachmentDto } from './product.dto';

const CHAT_TEXT_MAX_LENGTH = 4096;

export const CHAT_LIST_FILTERS = [
  'unread',
  'pending_approval',
  'handed_off',
] as const;
export type ChatListFilter = (typeof CHAT_LIST_FILTERS)[number];

export class SendChatMessageDto {
  @IsString()
  @MaxLength(CHAT_TEXT_MAX_LENGTH)
  text!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_DOCUMENT_ATTACHMENTS)
  @ValidateNested({ each: true })
  @Type(() => ProductAttachmentDto)
  attachments?: ProductAttachmentDto[];
}

export class LinkChatCustomerDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  customerId!: string;
}

export class SetChatAgentPausedDto {
  @IsBoolean()
  paused!: boolean;
}

export class EditSuggestionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(CHAT_TEXT_MAX_LENGTH)
  text!: string;
}

export class ApproveSuggestionDto {
  @IsOptional()
  @IsString()
  @MaxLength(CHAT_TEXT_MAX_LENGTH)
  text?: string;
}

export class ListChatsQueryDto {
  @IsOptional()
  @IsEnum(ChatChannel)
  channel?: ChatChannel;

  @IsOptional()
  @IsIn(CHAT_LIST_FILTERS)
  filter?: ChatListFilter;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;
}

/** A quién va una plantilla de WhatsApp: el chat, o el cliente del pedido o presupuesto. */
export class TemplateTargetDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  conversationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  orderId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  quoteId?: string;
}

export class SendTemplateDto extends TemplateTargetDto {
  @IsIn(CUSTOMER_TEMPLATE_KEYS)
  templateKey!: CustomerTemplateKey;
}
