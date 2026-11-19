import { AppConfigService } from '../config/app-config.service';
import { MetaGraphClient } from '../meta/meta-graph.client';
import {
  flattenTemplateParam,
  MetaWhatsAppSender,
} from './meta-whatsapp.sender';

describe('MetaWhatsAppSender', () => {
  const sendWhatsApp = jest.fn();

  function sender(whatsappConfigured = true) {
    sendWhatsApp.mockReset().mockResolvedValue('wamid.1');
    return new MetaWhatsAppSender(
      { whatsappConfigured } as AppConfigService,
      { sendWhatsApp } as unknown as MetaGraphClient,
    );
  }

  it('aplana el texto: viñetas, saltos, tabs, espacios y largo', () => {
    expect(
      flattenTemplateParam(
        'Atrasados (2):\n• ord-1\n• ord-2\n\nStock\tbajo     ya',
      ),
    ).toBe('Atrasados (2): • ord-1 • ord-2 · Stock bajo   ya');
    expect(flattenTemplateParam('x'.repeat(1200))).toHaveLength(1000);
  });

  it('manda siempre la plantilla aviso_odell al número de ALERTS_WHATSAPP_TO', async () => {
    await sender().send({ to: '+54 9 351 555-0142', text: 'Hola\nchau' });
    expect(sendWhatsApp).toHaveBeenCalledWith('5493515550142', {
      type: 'template',
      template: {
        name: 'aviso_odell',
        language: 'es_AR',
        params: ['Hola · chau'],
      },
    });
  });

  it('sin destinatario o sin credenciales solo loguea', async () => {
    await sender().send({ to: '', text: 'x' });
    await sender(false).send({ to: '5491100000000', text: 'x' });
    expect(sendWhatsApp).not.toHaveBeenCalled();
  });
});
