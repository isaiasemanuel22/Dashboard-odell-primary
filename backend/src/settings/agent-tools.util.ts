import { ApiKeyScope } from '../api-keys/api-key-scopes';
import { AgentToolsSettings } from '../common/interfaces';

export type McpToolName = keyof AgentToolsSettings;

/** Herramientas del servidor MCP y el permiso de llave que pide cada una (§28.4). */
export const MCP_TOOLS: { name: McpToolName; scope: ApiKeyScope }[] = [
  { name: 'consultar_stock', scope: 'catalogo:leer' },
  { name: 'cotizar_producto', scope: 'catalogo:leer' },
  { name: 'ver_cola', scope: 'cola:leer' },
  { name: 'crear_presupuesto', scope: 'presupuestos:borrador' },
  { name: 'registrar_pago', scope: 'pagos:proponer' },
];

/** Arrancan prendidas, salvo registrar_pago (§28.4). */
export const DEFAULT_AGENT_TOOLS: AgentToolsSettings = {
  consultar_stock: true,
  cotizar_producto: true,
  ver_cola: true,
  crear_presupuesto: true,
  registrar_pago: false,
};

/** Asegura forma y valores válidos al cargar o guardar las herramientas. */
export function normalizeAgentTools(raw: unknown): AgentToolsSettings {
  const source =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const read = (key: McpToolName): boolean =>
    typeof source[key] === 'boolean' ? source[key] : DEFAULT_AGENT_TOOLS[key];
  return {
    consultar_stock: read('consultar_stock'),
    cotizar_producto: read('cotizar_producto'),
    ver_cola: read('ver_cola'),
    crear_presupuesto: read('crear_presupuesto'),
    registrar_pago: read('registrar_pago'),
  };
}
