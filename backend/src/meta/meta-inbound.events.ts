import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';
import { ChatChannel } from '../common/enums';

export interface MetaInboundEvent {
  conversationId: string;
  messageId: string;
  channel: ChatChannel;
  externalId: string;
}

/** Mensajes entrantes ya guardados en Chats; el agente de atención se suscribe acá. */
@Injectable()
export class MetaInboundEvents {
  readonly inbound$ = new Subject<MetaInboundEvent>();
}
