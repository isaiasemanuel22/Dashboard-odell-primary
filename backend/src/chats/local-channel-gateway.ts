import { Injectable } from '@nestjs/common';
import { ChannelGateway } from './channel-gateway';

/** No sale a la red: el mensaje queda como enviado. La conexión con Meta reemplaza este provider. */
@Injectable()
export class LocalChannelGateway implements ChannelGateway {
  send(): Promise<{ externalMessageId: string | null }> {
    return Promise.resolve({ externalMessageId: null });
  }
}
