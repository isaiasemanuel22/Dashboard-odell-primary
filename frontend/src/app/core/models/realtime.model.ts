export type RealtimeScope =
  | 'all'
  | 'dashboard'
  | 'orders'
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

export interface RealtimePing {
  type: 'ping';
  at: string;
}

export type RealtimeMessage = RealtimeEvent | RealtimePing;

export function isRealtimeEvent(
  message: RealtimeMessage,
): message is RealtimeEvent {
  return 'scope' in message;
}
