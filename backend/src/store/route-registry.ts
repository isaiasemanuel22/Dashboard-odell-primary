import {
  RealtimeAction,
  RealtimeEntity,
  RealtimeScope,
} from '../realtime/realtime.types';
import { ALL_STORE_COLLECTIONS, StoreCollection } from './store.collections';

export interface RouteMutationMeta {
  collections: StoreCollection[];
  scopes: RealtimeScope[];
  entity?: RealtimeEntity;
}

type PathRule = {
  matches: (path: string) => boolean;
  meta: RouteMutationMeta;
};

const PATH_RULES: PathRule[] = [
  {
    matches: (path) => /\/quotes\/[^/]+\/order/.test(path),
    meta: {
      collections: ['quotes', 'orders', 'printJobs', 'products'],
      scopes: ['dashboard', 'quotes', 'orders', 'print-jobs'],
      entity: 'order',
    },
  },
  {
    matches: (path) => path.includes('/quotes'),
    meta: {
      collections: ['quotes'],
      scopes: ['dashboard', 'quotes'],
      entity: 'quote',
    },
  },
  {
    matches: (path) => path.includes('/orders'),
    meta: {
      collections: ['orders', 'printJobs', 'products'],
      scopes: ['orders', 'print-jobs', 'dashboard', 'sales'],
      entity: 'order',
    },
  },
  {
    matches: (path) => path.includes('/print-jobs'),
    meta: {
      collections: ['printJobs', 'orders', 'products'],
      scopes: ['print-jobs', 'orders', 'dashboard'],
      entity: 'print-job',
    },
  },
  {
    matches: (path) => path.includes('/sales'),
    meta: {
      collections: ['retailSales', 'products'],
      scopes: ['sales', 'dashboard'],
      entity: 'sale',
    },
  },
  {
    matches: (path) => path.includes('/products'),
    meta: {
      collections: ['products', 'brands'],
      scopes: ['products'],
      entity: 'product',
    },
  },
  {
    matches: (path) => path.includes('/categories'),
    meta: {
      collections: ['categories', 'products'],
      scopes: ['products'],
      entity: 'category',
    },
  },
  {
    matches: (path) => path.includes('/customers'),
    meta: {
      collections: ['customers', 'orders'],
      scopes: ['customers'],
      entity: 'customer',
    },
  },
  {
    matches: (path) => path.includes('/brands'),
    meta: {
      collections: ['brands', 'settings', 'supplies', 'products'],
      scopes: ['settings', 'supplies', 'products'],
      entity: 'settings',
    },
  },
  {
    matches: (path) => path.includes('/supplies'),
    meta: {
      collections: ['supplies', 'brands', 'printJobs', 'treasuryExpenses'],
      scopes: ['supplies', 'print-jobs', 'dashboard'],
      entity: 'supply',
    },
  },
  {
    matches: (path) => path.includes('/treasury'),
    meta: {
      collections: ['treasuryExpenses', 'supplies'],
      scopes: ['dashboard', 'supplies'],
      entity: 'settings',
    },
  },
  {
    matches: (path) => path.includes('/impresos'),
    meta: {
      collections: ['impresos'],
      scopes: ['settings', 'products'],
      entity: 'settings',
    },
  },
  {
    matches: (path) =>
      path.includes('/settings') || path.includes('/upload'),
    meta: {
      collections: ['settings', 'brands', 'supplies', 'products'],
      scopes: ['settings', 'products'],
      entity: 'settings',
    },
  },
  {
    matches: (path) => path.includes('/calendar'),
    meta: {
      collections: ['calendarEntries'],
      scopes: ['dashboard', 'calendar'],
      entity: 'calendar-entry',
    },
  },
];

export function routeMutationMetaFromPath(path: string): RouteMutationMeta {
  for (const rule of PATH_RULES) {
    if (rule.matches(path)) {
      return rule.meta;
    }
  }

  return {
    collections: [...ALL_STORE_COLLECTIONS],
    scopes: ['all'],
  };
}

/** @deprecated Use routeMutationMetaFromPath().collections */
export function collectionsFromPath(path: string): StoreCollection[] {
  return routeMutationMetaFromPath(path).collections;
}

export { ALL_STORE_COLLECTIONS };

export function actionFromHttpMethod(method: string): RealtimeAction {
  if (method === 'DELETE') return 'delete';
  if (method === 'POST') return 'create';
  return 'update';
}

export function idFromMutationPath(path: string): string | undefined {
  const segments = path.split('/').filter(Boolean);
  const apiIndex = segments.indexOf('api');
  const resourceIndex = apiIndex >= 0 ? apiIndex + 2 : 1;
  const candidate = segments[resourceIndex];
  if (!candidate || candidate === 'board' || candidate === 'overview') {
    return undefined;
  }
  return candidate;
}

export function normalizeApiPath(originalUrl: string): string {
  return originalUrl.startsWith('/api') ? originalUrl : `/api${originalUrl}`;
}

export function shouldTrackHttpMutation(path: string, method: string): boolean {
  if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(method.toUpperCase())) {
    return false;
  }
  if (
    path.includes('/events/') ||
    path.includes('/preview-')
  ) {
    return false;
  }
  return true;
}
