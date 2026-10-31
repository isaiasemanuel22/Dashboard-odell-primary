import {
  FilamentType,
  OrderStatus,
  QuoteStatus,
  PaperType,
  PrintJobStatus,
  ProductType,
  ResinType,
  SaleSource,
  ServiceType,
  SupplyCategory,
  TaskKind,
} from '../../core/models';

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  [ServiceType.IMPRESION_3D]: 'Impresión 3D',
  [ServiceType.DISENO_GRAFICO]: 'Diseño gráfico',
  [ServiceType.MODELADO]: 'Modelado',
  [ServiceType.ESTAMPADO]: 'Estampado',
};

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  [ProductType.FDM]: 'FDM',
  [ProductType.RESINA]: 'Resina',
  [ProductType.ESTAMPADO]: 'Estampado',
  [ProductType.COMBO]: 'Combo',
};

export const SUPPLY_CATEGORY_LABELS: Record<SupplyCategory, string> = {
  [SupplyCategory.FDM]: 'FDM',
  [SupplyCategory.RESINA]: 'Resina',
  [SupplyCategory.ESTAMPADO]: 'Estampado',
  [SupplyCategory.GENERAL]: 'General',
};

export const PAPER_TYPE_LABELS: Record<PaperType, string> = {
  [PaperType.SUBLIMACION]: 'Sublimación',
  [PaperType.DTF]: 'DTF',
  [PaperType.DTF_UV]: 'DTF UV',
};

export const FILAMENT_TYPE_LABELS: Record<FilamentType, string> = {
  [FilamentType.PLA]: 'PLA',
  [FilamentType.PETG]: 'PETG',
  [FilamentType.TPU]: 'TPU',
  [FilamentType.ABS]: 'ABS',
  [FilamentType.ASA]: 'ASA',
  [FilamentType.NYLON]: 'Nylon',
  [FilamentType.OTRO]: 'Otro',
};

export const RESIN_TYPE_LABELS: Record<ResinType, string> = {
  [ResinType.TRANSLUCIDA]: 'Translúcida',
  [ResinType.DURA]: 'Dura',
  [ResinType.FLEXIBLE]: 'Flexible',
  [ResinType.CASTING]: 'Casting',
  [ResinType.ESTANDAR]: 'Estándar',
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  [OrderStatus.PENDIENTE]: 'Pendiente',
  [OrderStatus.EN_PROGRESO]: 'En progreso',
  [OrderStatus.TERMINADO]: 'Terminado',
  [OrderStatus.PARCIALMENTE_ENTREGADO]: 'Parcialmente entregado',
  [OrderStatus.ENTREGADO]: 'Entregado',
  [OrderStatus.CANCELADO]: 'Cancelado',
};

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  [QuoteStatus.BORRADOR]: 'Borrador',
  [QuoteStatus.ENVIADO]: 'Enviado',
  [QuoteStatus.ACEPTADO]: 'Aceptado',
  [QuoteStatus.RECHAZADO]: 'Rechazado',
  [QuoteStatus.CANCELADO]: 'Cancelado',
};

export const ORDER_STATUS_CHANGE_SOURCE_LABELS: Record<
  'manual' | 'auto',
  string
> = {
  manual: 'Manual',
  auto: 'Cola de trabajo',
};

export const PRINT_JOB_STATUS_LABELS: Record<PrintJobStatus, string> = {
  [PrintJobStatus.POR_HACER]: 'Pendiente',
  [PrintJobStatus.EN_PROCESO]: 'En progreso',
  [PrintJobStatus.BLOQUEADO]: 'Bloqueado',
  [PrintJobStatus.EN_REVISION]: 'En revisión',
  [PrintJobStatus.TERMINADO]: 'Terminado',
  [PrintJobStatus.CANCELADO]: 'Cancelado',
};

export const TASK_KIND_LABELS: Record<TaskKind, string> = {
  [TaskKind.PREPARE_ORDER]: 'Preparar pedido',
  [TaskKind.PRODUCTION]: 'Producción',
  [TaskKind.SERVICE]: 'Servicio',
  [TaskKind.INTERNAL]: 'Interna',
};

export const SALE_SOURCE_LABELS: Record<SaleSource, string> = {
  [SaleSource.RETAIL]: 'Mostrador',
  [SaleSource.ORDER]: 'Pedido',
};

export type BoardColumnAccent =
  | 'muted'
  | 'primary'
  | 'warning'
  | 'review'
  | 'success'
  | 'cancel';

export interface WorkBoardColumnConfig {
  status: PrintJobStatus;
  label: string;
  accent: BoardColumnAccent;
}

/** Columnas principales del tablero (mock). Cancelado solo si hay tareas. */
export const WORK_BOARD_COLUMNS: WorkBoardColumnConfig[] = [
  {
    status: PrintJobStatus.POR_HACER,
    label: 'Por hacer',
    accent: 'muted',
  },
  {
    status: PrintJobStatus.EN_PROCESO,
    label: 'En progreso',
    accent: 'primary',
  },
  {
    status: PrintJobStatus.BLOQUEADO,
    label: 'Bloqueado',
    accent: 'warning',
  },
  {
    status: PrintJobStatus.EN_REVISION,
    label: 'En revisión',
    accent: 'review',
  },
  {
    status: PrintJobStatus.TERMINADO,
    label: 'Terminado',
    accent: 'success',
  },
];

export const WORK_BOARD_CANCELLED_COLUMN: WorkBoardColumnConfig = {
  status: PrintJobStatus.CANCELADO,
  label: 'Cancelado',
  accent: 'cancel',
};

/** Filtros rápidos por área en la cola (según mock). */
export const WORK_BOARD_AREA_FILTERS: {
  value: ServiceType | null;
  label: string;
}[] = [
  { value: null, label: 'Todas' },
  { value: ServiceType.IMPRESION_3D, label: 'Impresión 3D' },
  { value: ServiceType.ESTAMPADO, label: 'Estampado' },
  { value: ServiceType.DISENO_GRAFICO, label: 'Diseño gráfico' },
  { value: ServiceType.MODELADO, label: 'Modelado' },
];
