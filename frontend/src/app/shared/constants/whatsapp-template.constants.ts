import { WhatsAppTemplate } from '../../core/models';

/** Variables disponibles en las plantillas de WhatsApp (§28.1). */
export interface WhatsAppTemplateVariable {
  /** Nombre sin llaves: en el texto se escribe `{key}`. */
  key: 'cliente' | 'pedido' | 'items' | 'total' | 'pagado' | 'saldo' | 'entrega';
  label: string;
  example: string;
}

export const WHATSAPP_TEMPLATE_VARIABLES: readonly WhatsAppTemplateVariable[] = [
  { key: 'cliente', label: 'Cliente', example: 'Lucía Pérez' },
  { key: 'pedido', label: 'Pedido', example: 'ord-12' },
  { key: 'items', label: 'Ítems', example: '2 × Taza personalizada' },
  { key: 'total', label: 'Total', example: '$ 24.000' },
  { key: 'pagado', label: 'Pagado', example: '$ 12.000' },
  { key: 'saldo', label: 'Saldo', example: '$ 12.000' },
  { key: 'entrega', label: 'Entrega', example: '28/11/2026' },
];

export const WHATSAPP_TEMPLATE_PRESUPUESTO_ID = 'tpl-presupuesto';
export const WHATSAPP_TEMPLATE_DISENO_ID = 'tpl-diseno';
export const WHATSAPP_TEMPLATE_LISTO_ID = 'tpl-listo';
export const WHATSAPP_TEMPLATE_SALDO_ID = 'tpl-saldo';

/** Plantillas por defecto (espejo de las del backend). Sin horario de retiro. */
export const DEFAULT_WHATSAPP_TEMPLATES: readonly WhatsAppTemplate[] = [
  {
    id: WHATSAPP_TEMPLATE_PRESUPUESTO_ID,
    name: 'Presupuesto enviado',
    body:
      'Hola {cliente}, te paso el presupuesto {pedido}:\n{items}\n\nTotal: {total}.\n' +
      '¿Lo confirmamos? Cualquier duda, avisame.',
    builtIn: true,
  },
  {
    id: WHATSAPP_TEMPLATE_DISENO_ID,
    name: 'Diseño para aprobar',
    body:
      'Hola {cliente}, te mando el diseño de tu pedido {pedido} para que lo revises.\n' +
      'Si está todo bien, avisame y seguimos con la producción.',
    builtIn: true,
  },
  {
    id: WHATSAPP_TEMPLATE_LISTO_ID,
    name: 'Tu pedido está listo',
    body:
      'Hola {cliente}, tu pedido {pedido} está listo.\n{items}\n' +
      'Saldo a abonar: {saldo}. Avisame cuándo pasás a retirarlo.',
    builtIn: true,
  },
  {
    id: WHATSAPP_TEMPLATE_SALDO_ID,
    name: 'Recordatorio de saldo',
    body:
      'Hola {cliente}, te recuerdo que tu pedido {pedido} tiene un saldo pendiente de {saldo} ' +
      '(total {total}, pagado {pagado}). ¡Gracias!',
    builtIn: true,
  },
];
