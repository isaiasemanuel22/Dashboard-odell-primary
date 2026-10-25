export enum ServiceType {
  IMPRESION_3D = 'impresion_3d',
  DISENO_GRAFICO = 'diseno_grafico',
  MODELADO = 'modelado',
  ESTAMPADO = 'estampado',
}

export enum ProductType {
  FDM = 'fdm',
  RESINA = 'resina',
  ESTAMPADO = 'estampado',
  COMBO = 'combo',
}

export enum SupplyCategory {
  FDM = 'fdm',
  RESINA = 'resina',
  ESTAMPADO = 'estampado',
  GENERAL = 'general',
}

export enum QuoteStatus {
  BORRADOR = 'borrador',
  ENVIADO = 'enviado',
  ACEPTADO = 'aceptado',
  RECHAZADO = 'rechazado',
  CANCELADO = 'cancelado',
}

export enum OrderStatus {
  PENDIENTE = 'pendiente',
  EN_PROGRESO = 'en_progreso',
  TERMINADO = 'terminado',
  PARCIALMENTE_ENTREGADO = 'parcialmente_entregado',
  ENTREGADO = 'entregado',
  CANCELADO = 'cancelado',
  /** @deprecated Compatibilidad de código; se persiste el valor objetivo. */
  EN_PRODUCCION = 'en_progreso',
  /** @deprecated Compatibilidad de código; se persiste el valor objetivo. */
  COMPLETADO = 'terminado',
}

export enum PrintJobStatus {
  POR_HACER = 'por_hacer',
  EN_PROCESO = 'en_proceso',
  BLOQUEADO = 'bloqueado',
  EN_REVISION = 'en_revision',
  TERMINADO = 'terminado',
  CANCELADO = 'cancelado',
}

export enum TaskType {
  PREPARE_ORDER = 'PREPARE_ORDER',
  PRODUCTION = 'PRODUCTION',
  SERVICE = 'SERVICE',
  INTERNAL = 'INTERNAL',
}

export enum SaleSource {
  RETAIL = 'retail',
  ORDER = 'order',
}

export enum TreasuryExpenseCategory {
  SUPPLY_PURCHASE = 'supply_purchase',
  WITHDRAWAL = 'withdrawal',
  SALARY = 'salary',
  TRANSPORT = 'transport',
  PAYMENT = 'payment',
  LOAN = 'loan',
  LOAN_REPAYMENT = 'loan_repayment',
  OTHER = 'other',
}

export enum TreasuryMovementDirection {
  INCOME = 'income',
  EXPENSE = 'expense',
}

export enum BrandMaterialType {
  FILAMENT = 'filament',
  RESIN = 'resin',
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

/** Acciones de permiso por área (§22 BUSINESS-RULES). */
export enum PermissionAction {
  VIEW = 'view',
  CREATE = 'create',
  MODIFY = 'modify',
  CANCEL = 'cancel',
  APPROVE = 'approve',
  MANAGE_USERS = 'manage_users',
  MANAGE_ROLES = 'manage_roles',
  MANAGE_AREAS = 'manage_areas',
}

export const WORK_PERMISSION_ACTIONS: PermissionAction[] = [
  PermissionAction.VIEW,
  PermissionAction.CREATE,
  PermissionAction.MODIFY,
  PermissionAction.CANCEL,
  PermissionAction.APPROVE,
];

export const ADMIN_PERMISSION_ACTIONS: PermissionAction[] = [
  PermissionAction.MANAGE_USERS,
  PermissionAction.MANAGE_ROLES,
  PermissionAction.MANAGE_AREAS,
];
