/** Permisos que puede tener una llave de agente (§28.4). Única fuente. */
export const API_KEY_SCOPE_OPTIONS = [
  { id: 'catalogo:leer', label: 'Ver catálogo y stock' },
  { id: 'cola:leer', label: 'Ver cola de impresión' },
  { id: 'pedidos:leer', label: 'Ver pedidos' },
  { id: 'presupuestos:borrador', label: 'Crear presupuestos en borrador' },
  { id: 'pagos:proponer', label: 'Proponer pagos' },
] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPE_OPTIONS)[number]['id'];

export const API_KEY_SCOPES: ApiKeyScope[] = API_KEY_SCOPE_OPTIONS.map(
  (option) => option.id,
);

export interface ApiKeyPrincipal {
  id: string;
  name: string;
  scopes: ApiKeyScope[];
}
