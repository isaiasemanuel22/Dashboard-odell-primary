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
  | 'materials';

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
  | 'material'
  | 'settings';

export interface RealtimeEvent {
  scope: RealtimeScope;
  at: string;
  action?: RealtimeAction;
  entity?: RealtimeEntity;
  id?: string;
}
