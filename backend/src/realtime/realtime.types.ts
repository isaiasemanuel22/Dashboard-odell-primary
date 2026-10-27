export type RealtimeScope =
  | 'all'
  | 'dashboard'
  | 'orders'
  | 'quotes'
  | 'products'
  | 'sales'
  | 'customers'
  | 'print-jobs'
  | 'supplies'
  | 'settings'
  | 'calendar';

export type RealtimeAction = 'create' | 'update' | 'delete';

export type RealtimeEntity =
  | 'order'
  | 'quote'
  | 'product'
  | 'customer'
  | 'category'
  | 'print-job'
  | 'sale'
  | 'supply'
  | 'settings'
  | 'calendar-entry';

export interface RealtimeEvent {
  scope: RealtimeScope;
  at: string;
  action?: RealtimeAction;
  entity?: RealtimeEntity;
  id?: string;
}
