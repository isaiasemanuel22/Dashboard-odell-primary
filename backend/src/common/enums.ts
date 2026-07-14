export enum ServiceType {
  IMPRESION_3D = 'impresion_3d',
  DISENO = 'diseno',
  ESTAMPADO = 'estampado',
}

export enum ProductType {
  FDM = 'fdm',
  RESINA = 'resina',
  ESTAMPADO = 'estampado',
}

export enum OrderStatus {
  PENDIENTE = 'pendiente',
  EN_PRODUCCION = 'en_produccion',
  COMPLETADO = 'completado',
  ENTREGADO = 'entregado',
  CANCELADO = 'cancelado',
}

export enum PrintJobStatus {
  POR_HACER = 'por_hacer',
  EN_PROCESO = 'en_proceso',
  BLOQUEADO = 'bloqueado',
  EN_REVISION = 'en_revision',
  TERMINADO = 'terminado',
  CANCELADO = 'cancelado',
}

export enum SaleSource {
  RETAIL = 'retail',
  ORDER = 'order',
}

export enum SupplyType {
  FILAMENTO = 'filamento',
  RESINA = 'resina',
  ALCOHOL = 'alcohol',
  TINTA = 'tinta',
  REMERA = 'remera',
  TAZA = 'taza',
  BUZO = 'buzo',
  GORRA = 'gorra',
  FILM = 'film',
  VINILO = 'vinilo',
  OTRO = 'otro',
}

export enum FilamentType {
  PLA = 'pla',
  PETG = 'petg',
  TPU = 'tpu',
  ABS = 'abs',
  ASA = 'asa',
  NYLON = 'nylon',
  OTRO = 'otro',
}

export enum ResinType {
  TRANSLUCIDA = 'translucida',
  DURA = 'dura',
  FLEXIBLE = 'flexible',
  CASTING = 'casting',
  ESTANDAR = 'estandar',
}

export enum PaperType {
  SUBLIMACION = 'sublimacion',
  DTF = 'dtf',
  DTF_UV = 'dtf_uv',
}

export enum MachineProfileRole {
  PRINT = 'print',
  WASH = 'wash',
  CURE = 'cure',
  PRESS = 'press',
}
