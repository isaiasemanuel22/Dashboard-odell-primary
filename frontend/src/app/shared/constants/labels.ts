import {
  FilamentType,
  OrderStatus,
  PaperType,
  PrintJobStatus,
  ProductType,
  ResinType,
  SaleSource,
  ServiceType,
  SupplyType,
} from '../../core/models';

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  [ServiceType.IMPRESION_3D]: 'Impresión 3D',
  [ServiceType.DISENO]: 'Diseño',
  [ServiceType.ESTAMPADO]: 'Estampado',
};

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  [ProductType.FDM]: 'FDM',
  [ProductType.RESINA]: 'Resina',
  [ProductType.ESTAMPADO]: 'Estampado',
};

export const PAPER_TYPE_LABELS: Record<PaperType, string> = {
  [PaperType.SUBLIMACION]: 'Sublimación',
  [PaperType.DTF]: 'DTF',
  [PaperType.DTF_UV]: 'DTF UV',
};

export const SUPPLY_TYPE_LABELS: Record<SupplyType, string> = {
  [SupplyType.FILAMENTO]: 'Filamento',
  [SupplyType.RESINA]: 'Resina',
  [SupplyType.ALCOHOL]: 'Alcohol isopropílico',
  [SupplyType.TINTA]: 'Tinta',
  [SupplyType.REMERA]: 'Remera',
  [SupplyType.TAZA]: 'Taza',
  [SupplyType.BUZO]: 'Buzo',
  [SupplyType.GORRA]: 'Gorra',
  [SupplyType.FILM]: 'Film DTF',
  [SupplyType.VINILO]: 'Vinilo',
  [SupplyType.OTRO]: 'Otro',
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
  [OrderStatus.EN_PRODUCCION]: 'En producción',
  [OrderStatus.COMPLETADO]: 'Completado',
  [OrderStatus.ENTREGADO]: 'Entregado',
  [OrderStatus.CANCELADO]: 'Cancelado',
};

export const ORDER_STATUS_CHANGE_SOURCE_LABELS: Record<
  'manual' | 'auto',
  string
> = {
  manual: 'Manual',
  auto: 'Cola de trabajo',
};

export const PRINT_JOB_STATUS_LABELS: Record<PrintJobStatus, string> = {
  [PrintJobStatus.POR_HACER]: 'Por hacer',
  [PrintJobStatus.EN_PROCESO]: 'En proceso',
  [PrintJobStatus.BLOQUEADO]: 'Bloqueado',
  [PrintJobStatus.EN_REVISION]: 'En revisión',
  [PrintJobStatus.TERMINADO]: 'Terminado',
  [PrintJobStatus.CANCELADO]: 'Cancelado',
};

export const SALE_SOURCE_LABELS: Record<SaleSource, string> = {
  [SaleSource.RETAIL]: 'Mostrador',
  [SaleSource.ORDER]: 'Pedido',
};

export const WORK_BOARD_COLUMNS: { status: PrintJobStatus; label: string }[] = [
  { status: PrintJobStatus.POR_HACER, label: 'Por hacer' },
  { status: PrintJobStatus.EN_PROCESO, label: 'En proceso' },
  { status: PrintJobStatus.BLOQUEADO, label: 'Bloqueado' },
  { status: PrintJobStatus.EN_REVISION, label: 'En revisión' },
  { status: PrintJobStatus.TERMINADO, label: 'Terminado' },
  { status: PrintJobStatus.CANCELADO, label: 'Cancelado' },
];
