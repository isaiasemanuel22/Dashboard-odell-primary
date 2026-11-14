import { request, type APIRequestContext } from '@playwright/test';

export const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3000/api';

/** Prefijo unico por corrida: E2E-<timestamp>. Todo dato de prueba debe empezar con "E2E-". */
export const RUN_ID = `E2E-${Date.now()}`;

/** Nombre unico con prefijo: e2eName('cliente') -> "E2E-1731555555555 cliente". */
export function e2eName(label = ''): string {
  return `${RUN_ID} ${label}`.trim();
}

let ctx: APIRequestContext | undefined;
const created: Array<{ resource: string; id: string }> = [];

/** Contexto HTTP hacia el backend. Sin token en local; E2E_BEARER_TOKEN opcional. */
export async function api(): Promise<APIRequestContext> {
  if (!ctx) {
    const token = process.env.E2E_BEARER_TOKEN;
    ctx = await request.newContext({
      baseURL: API_URL.replace(/\/?$/, '/'),
      extraHTTPHeaders: token ? { Authorization: `Bearer ${token}` } : {},
    });
  }
  return ctx;
}

const rel = (p: string) => p.replace(/^\//, '');

export async function apiGet<T = unknown>(path: string): Promise<T> {
  const res = await (await api()).get(rel(path));
  if (!res.ok()) throw new Error(`GET ${path} -> ${res.status()} ${await res.text()}`);
  return (await res.json()) as T;
}

/** POST generico. Si la respuesta trae id y `track` es true, queda registrado para cleanup. */
export async function apiPost<T extends { id?: string }>(
  resource: string,
  body: unknown,
  track = true,
): Promise<T> {
  const res = await (await api()).post(rel(resource), { data: body });
  if (!res.ok()) throw new Error(`POST ${resource} -> ${res.status()} ${await res.text()}`);
  const json = (await res.json()) as T;
  if (track && json?.id) created.push({ resource, id: json.id });
  return json;
}

export async function apiPatch<T = unknown>(path: string, body: unknown): Promise<T> {
  const res = await (await api()).patch(rel(path), { data: body });
  if (!res.ok()) throw new Error(`PATCH ${path} -> ${res.status()} ${await res.text()}`);
  return (await res.json()) as T;
}

export async function apiDelete(path: string): Promise<boolean> {
  const res = await (await api()).delete(rel(path));
  return res.ok();
}

/** Crea un cliente E2E-. Devuelve el cliente (con id). */
export function createCustomer(overrides: Record<string, unknown> = {}) {
  return apiPost<{ id: string; name: string }>('customers', {
    name: e2eName('cliente'),
    phone: '1100000000',
    ...overrides,
  });
}

/** Crea un insumo E2E-. Ver SupplyCategory/CreateSupplyDto en backend/src/common/dto/settings.dto.ts. */
export function createSupply(body: Record<string, unknown>) {
  return apiPost<{ id: string; name: string }>('supplies', { name: e2eName('insumo'), ...body });
}

/** Crea un producto E2E- (CreateProductDto: ver backend/src/common/dto). Pasar el body completo. */
export function createProduct(body: Record<string, unknown>) {
  return apiPost<{ id: string; name: string }>('products', { name: e2eName('producto'), ...body });
}

/** Crea un pedido E2E- (CreateOrderDto; exige responsibleUserId). */
export function createOrder(body: Record<string, unknown>) {
  return apiPost<{ id: string }>('orders', body);
}

/** Crea un presupuesto E2E-. */
export function createQuote(body: Record<string, unknown>) {
  return apiPost<{ id: string }>('quotes', body);
}

/** Borra lo creado por esta corrida (orden inverso). Llamar en afterAll. Nunca lanza. */
export async function cleanupCreated(): Promise<void> {
  while (created.length) {
    const { resource, id } = created.pop()!;
    try {
      await apiDelete(`${resource}/${id}`);
    } catch {
      /* best effort */
    }
  }
}

/**
 * Barrido de seguridad: borra por API todo lo que empiece con "E2E-" en los recursos con DELETE
 * (customers, supplies, products, orders, quotes). Util para dejar la base limpia.
 */
export async function purgeE2EData(): Promise<number> {
  let n = 0;
  for (const resource of ['orders', 'quotes', 'products', 'supplies', 'customers']) {
    let list: Array<{ id: string; name?: string; customerName?: string; title?: string }> = [];
    try {
      list = await apiGet(resource);
    } catch {
      continue;
    }
    for (const item of list) {
      const label = item.name ?? item.customerName ?? item.title ?? '';
      if (label.startsWith('E2E-') && (await apiDelete(`${resource}/${item.id}`))) n++;
    }
  }
  return n;
}
