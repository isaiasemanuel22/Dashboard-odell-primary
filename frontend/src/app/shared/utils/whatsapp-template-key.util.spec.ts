import { Order } from '../../core/models';
import {
  WA_KEY_BALANCE,
  WA_KEY_DESIGN,
  WA_KEY_READY,
  defaultOrderTemplateKey,
} from './whatsapp-template-key.util';

describe('defaultOrderTemplateKey', () => {
  const order = (partial: Partial<Order>) =>
    ({ status: 'en_produccion', total: 1000, payments: [], ...partial }) as Order;

  it('pedido terminado: «Tu pedido está listo»', () => {
    expect(defaultOrderTemplateKey(order({ status: 'terminado' } as never))).toBe(
      WA_KEY_READY,
    );
  });

  it('con saldo pendiente: recordatorio de saldo', () => {
    expect(defaultOrderTemplateKey(order({}))).toBe(WA_KEY_BALANCE);
  });

  it('sin saldo: diseño para aprobar', () => {
    expect(defaultOrderTemplateKey(order({ total: 0 }))).toBe(WA_KEY_DESIGN);
  });
});
