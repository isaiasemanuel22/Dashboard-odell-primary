import { Order } from '../../core/models';
import { orderBalanceAmount } from './order.helpers';

/** Claves de las plantillas de Meta para clientes (§28.2). */
export const WA_KEY_DESIGN = 'diseno_para_aprobar';
export const WA_KEY_READY = 'pedido_listo';
export const WA_KEY_BALANCE = 'recordatorio_saldo';
export const WA_KEY_QUOTE = 'presupuesto_enviado';

/** Plantilla que arranca elegida en un pedido según su estado y saldo. */
export function defaultOrderTemplateKey(
  order: Pick<Order, 'status' | 'total' | 'payments'>,
): string {
  if (order.status === 'terminado') return WA_KEY_READY;
  if (orderBalanceAmount(order) > 0) return WA_KEY_BALANCE;
  return WA_KEY_DESIGN;
}
