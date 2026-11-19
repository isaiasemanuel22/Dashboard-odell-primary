/** Versión de la Graph API de Meta (https://developers.facebook.com/docs/graph-api/changelog). */
export const GRAPH_API_VERSION = 'v27.0';
export const GRAPH_API_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export const META_TEMPLATE_LANGUAGE = 'es_AR';

/** Datos con los que se arman los parámetros de una plantilla. */
export interface MetaTemplateContext {
  name: string;
  reference: string;
  amount: string;
}

export interface MetaTemplate {
  key: string;
  label: string;
  /** Nombre con el que se da de alta en Meta. */
  name: string;
  category: 'UTILITY';
  body: string;
  example: string[];
  /** De dónde salen los datos: un presupuesto o un pedido. */
  source: 'quote' | 'order' | null;
  /** Arma los parámetros de una plantilla de cliente. */
  params?: (context: MetaTemplateContext) => string[];
}

/** Plantillas de WhatsApp (§28.2). Hay que darlas de alta igual en Meta. */
export const META_TEMPLATES = {
  presupuesto_enviado: {
    key: 'presupuesto_enviado',
    label: 'Presupuesto enviado',
    name: 'presupuesto_enviado',
    category: 'UTILITY',
    body: 'Hola {{1}}, te enviamos el presupuesto {{2}} por {{3}}. Si tenés dudas, respondé este mensaje.',
    example: ['Martina', 'quo-4', '$ 145.000'],
    source: 'quote',
    params: (c) => [c.name, c.reference, c.amount],
  },
  diseno_para_aprobar: {
    key: 'diseno_para_aprobar',
    label: 'Diseño para aprobar',
    name: 'diseno_para_aprobar',
    category: 'UTILITY',
    body: 'Hola {{1}}, ya está el diseño de tu pedido {{2}}. Respondé este mensaje para verlo y aprobarlo.',
    example: ['Martina', 'ord-12'],
    source: 'order',
    params: (c) => [c.name, c.reference],
  },
  pedido_listo: {
    key: 'pedido_listo',
    label: 'Tu pedido está listo',
    name: 'pedido_listo',
    category: 'UTILITY',
    body: 'Hola {{1}}, tu pedido {{2}} está listo para retirar.',
    example: ['Martina', 'ord-12'],
    source: 'order',
    params: (c) => [c.name, c.reference],
  },
  recordatorio_saldo: {
    key: 'recordatorio_saldo',
    label: 'Recordatorio de saldo',
    name: 'recordatorio_saldo',
    category: 'UTILITY',
    body: 'Hola {{1}}, te recordamos que el pedido {{2}} tiene un saldo de {{3}}.',
    example: ['Martina', 'ord-12', '$ 72.500'],
    source: 'order',
    params: (c) => [c.name, c.reference, c.amount],
  },
  aviso_odell: {
    key: 'aviso_odell',
    label: 'Aviso de Odell',
    name: 'aviso_odell',
    category: 'UTILITY',
    body: 'Aviso de Odell: {{1}}',
    example: ['Pedidos atrasados (1): ord-12 · Martina · $ 72.500'],
    source: null,
  },
} satisfies Record<string, MetaTemplate>;

export type MetaTemplateKey = keyof typeof META_TEMPLATES;

/** Las que manda Isaías a un cliente con un botón; aviso_odell es solo para él. */
export const CUSTOMER_TEMPLATE_KEYS = [
  'presupuesto_enviado',
  'diseno_para_aprobar',
  'pedido_listo',
  'recordatorio_saldo',
] as const;
export type CustomerTemplateKey = (typeof CUSTOMER_TEMPLATE_KEYS)[number];

/** Reemplaza {{1}}, {{2}}… del cuerpo por los parámetros. */
export function renderTemplateBody(body: string, params: string[]): string {
  return body.replace(
    /\{\{(\d+)\}\}/g,
    (match, n: string) => params[Number(n) - 1] ?? match,
  );
}
