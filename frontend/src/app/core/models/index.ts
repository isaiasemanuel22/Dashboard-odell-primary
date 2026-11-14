export enum ServiceType {
  IMPRESION_3D = 'impresion_3d',
  DISENO_GRAFICO = 'diseno_grafico',
  MODELADO = 'modelado',
  ESTAMPADO = 'estampado',
  /** Línea propia de insumo. No es un área (§5.1, §10). */
  INSUMO = 'insumo',
  /** Servicio de un tercero. No es un área (§5.1, §16.3). */
  SERVICIO_TERCERO = 'servicio_tercero',
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

export enum OrderStatus {
  PENDIENTE = 'pendiente',
  EN_PROGRESO = 'en_progreso',
  TERMINADO = 'terminado',
  PARCIALMENTE_ENTREGADO = 'parcialmente_entregado',
  ENTREGADO = 'entregado',
  CANCELADO = 'cancelado',
}

export enum QuoteStatus {
  BORRADOR = 'borrador',
  ENVIADO = 'enviado',
  ACEPTADO = 'aceptado',
  RECHAZADO = 'rechazado',
  CANCELADO = 'cancelado',
}

export enum CalendarEntryKind {
  EVENT = 'event',
  REMINDER = 'reminder',
}

export enum CalendarRepeat {
  NONE = 'none',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

export enum CalendarNotify {
  NONE = 'none',
  AT_TIME = 'at_time',
  ONE_HOUR = '1h',
  ONE_DAY = '1d',
  ONE_WEEK = '1w',
}

export enum CalendarLinkType {
  ORDER = 'order',
  QUOTE = 'quote',
  CUSTOMER = 'customer',
}

export type CalendarFeedType = 'delivery' | 'event' | 'reminder';

export interface CalendarEntry {
  id: string;
  kind: CalendarEntryKind;
  title: string;
  notes?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  allDay: boolean;
  repeat: CalendarRepeat;
  weekdays: number[];
  notify: CalendarNotify;
  linkType?: CalendarLinkType;
  linkId?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type CreateCalendarEntryPayload = Omit<
  CalendarEntry,
  'id' | 'createdAt' | 'updatedAt' | 'completedAt'
>;

export type UpdateCalendarEntryPayload = Partial<CreateCalendarEntryPayload>;

export interface CalendarFeedItem {
  id: string;
  type: CalendarFeedType;
  date: string;
  title: string;
  subtitle?: string;
  startTime?: string;
  endTime?: string;
  allDay?: boolean;
  completed?: boolean;
  late?: boolean;
  entryId?: string;
  orderId?: string;
  linkType?: CalendarLinkType;
  linkId?: string;
  total?: number;
  customerName?: string;
}

export enum PrintJobStatus {
  POR_HACER = 'por_hacer',
  EN_PROCESO = 'en_proceso',
  BLOQUEADO = 'bloqueado',
  EN_REVISION = 'en_revision',
  TERMINADO = 'terminado',
  CANCELADO = 'cancelado',
}

export enum TaskKind {
  PREPARE_ORDER = 'prepare_order',
  PRODUCTION = 'production',
  SERVICE = 'service',
  INTERNAL = 'internal',
}

export type OrderItemKind = 'product' | 'service';

export enum SaleSource {
  RETAIL = 'retail',
  ORDER = 'order',
}

export enum CustomerType {
  PARTICULAR = 'particular',
  EMPRESA = 'empresa',
  REVENDEDOR = 'revendedor',
}

/** Precio de lista o mayorista por pedido/presupuesto (§10). */
export enum PriceType {
  LISTA = 'lista',
  MAYORISTA = 'mayorista',
}

/** Canal de venta del pedido/presupuesto. */
export enum SalesChannel {
  MAYORISTA = 'mayorista',
  INSTAGRAM = 'instagram',
  WHATSAPP = 'whatsapp',
  TIENDANUBE = 'tiendanube',
  FERIA = 'feria',
  MOSTRADOR = 'mostrador',
}

export enum CustomerSource {
  INSTAGRAM = 'instagram',
  WHATSAPP = 'whatsapp',
  TIENDANUBE = 'tiendanube',
  FERIA = 'feria',
  RECOMENDACION = 'recomendacion',
  OTRO = 'otro',
}

export enum PaymentMethod {
  EFECTIVO = 'efectivo',
  TRANSFERENCIA = 'transferencia',
  MERCADO_PAGO = 'mercado_pago',
}

export enum TreasuryAccount {
  CAJA = 'caja',
  MERCADO_PAGO = 'mercado_pago',
  BANCO = 'banco',
}

export enum TreasuryExpenseCategory {
  SUPPLY_PURCHASE = 'supply_purchase',
  WITHDRAWAL = 'withdrawal',
  SALARY = 'salary',
  TRANSPORT = 'transport',
  PAYMENT = 'payment',
  LOAN = 'loan',
  LOAN_REPAYMENT = 'loan_repayment',
  TRANSFER = 'transfer',
  OTHER = 'other',
}

export enum TreasuryMovementDirection {
  INCOME = 'income',
  EXPENSE = 'expense',
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

export interface FilamentTypeConfig {
  id: string;
  name: string;
}

export interface ResinTypeConfig {
  id: string;
  name: string;
}

export interface FilamentPriceConfig {
  id: string;
  brand: string;
  filamentTypeId?: string;
  materialType: string;
  pricePerKg: number;
}

export interface ColorConfig {
  id: string;
  name: string;
  hex: string;
}

export const INDISTINTO_COLOR_ID = 'indistinto';

export interface ResinPriceConfig {
  id: string;
  brand: string;
  resinTypeId?: string;
  resinType: ResinType | string;
  pricePerLiter: number;
}

export interface PaperPricesPerSqm {
  sublimacion: number;
  dtf: number;
  dtfUv: number;
}

export interface PaperReferenceSheet {
  widthCm: number;
  lengthCm: number;
  price: number;
}

export interface PaperReferenceSheets {
  sublimacion: PaperReferenceSheet;
  dtf: PaperReferenceSheet;
  dtfUv: PaperReferenceSheet;
}

/** Margen de ganancia sobre el costo (%), por tipo de servicio. */
export interface ServiceProfitMargins {
  impresion_3d: number;
  diseno_grafico: number;
  modelado: number;
  estampado: number;
}

/** Descuento por mayor (revendedor): % sobre precio de lista, por áreas. */
export interface WholesaleDiscountSettings {
  enabled: boolean;
  percent: number;
  serviceTypes: ServiceType[];
}

export interface PowerConsumptionConfig {
  id: string;
  name: string;
  watts: number;
}

export interface MachineCostConfig {
  id: string;
  name: string;
  costPerHour: number;
}

export interface MachineProfile {
  id: string;
  name: string;
  role: MachineProfileRole;
  watts: number;
  costPerHour: number;
  /** Ausente = aplica a todos los tipos de producto */
  productType?: ProductType;
  washSupplyId?: string;
  consumptionMl?: number;
  /** Piezas que se lavan con el mismo baño antes de cambiar el insumo. */
  washBathUses?: number;
  /** Solo role=print: aparece en la cola de impresoras. */
  queueEnabled?: boolean;
  /** Solo role=print: horas de jornada (default 16). */
  workHoursPerDay?: number;
  /** Solo role=print: 0=dom..6=sáb (default lun–sáb). */
  workWeekdays?: number[];
  /** Solo role=print: inicio de jornada "HH:mm" (default "08:00"). */
  workStartHour?: string;
  /** Solo role=print: tipo de AMS (ej. "AMS lite"). */
  amsType?: string;
  /**
   * Legacy: ids de ColorConfig por ranura.
   * La cola y la UI de AMS se alimentan de bobinas abiertas, no de este campo.
   */
  amsSlots?: (string | null)[];
  /** Solo role=print: perfil usado para costear productos de ese productType. */
  costBase?: boolean;
}

export interface GeneralSettings {
  electricityCostPerKwh: number;
  /** % sobre material + energía + máquina, aplicado al costo de producto. */
  errorMarginPercent: number;
  powerConsumptions: PowerConsumptionConfig[];
  machineCosts: MachineCostConfig[];
  laborCostPerHour: number;
  /** Tarifa horaria de modelado 3D ($/h). */
  modelingRatePerHour: number;
  /** Tarifa horaria de diseño gráfico ($/h). */
  graphicDesignRatePerHour: number;
  profitMargins: ServiceProfitMargins;
  wholesaleDiscount: WholesaleDiscountSettings;
  paperPricesPerSqm: PaperPricesPerSqm;
  paperReferenceSheets: PaperReferenceSheets;
  filamentPrices: FilamentPriceConfig[];
  resinPrices: ResinPriceConfig[];
  /** Precio $/kg por tipo; usado al costear productos FDM (sin marca). */
  filamentTypeAverages: Partial<Record<FilamentType, number>>;
  /** Precio $/L por tipo; usado al costear productos resina (sin marca). */
  resinTypeAverages: Partial<Record<string, number>>;
  machineProfiles: MachineProfile[];
  colors: ColorConfig[];
  filamentTypes: FilamentTypeConfig[];
  resinTypes: ResinTypeConfig[];
}

export interface Impreso {
  id: string;
  name: string;
  paperType: PaperType;
  widthCm: number;
  lengthCm?: number;
  heightCm: number;
  updatedAt: string;
}

export interface ImpresoWithCost extends Impreso {
  areaSqm: number;
  paperCost: number;
}

export interface ImpresoCostPreview {
  areaSqm: number;
  paperCost: number;
}

export type CreateImpresoPayload = Omit<Impreso, 'id' | 'updatedAt'>;
export type UpdateImpresoPayload = Partial<CreateImpresoPayload>;

export interface SupplyPriceHistoryEntry {
  at: string;
  unitPrice: number;
}

export interface Supply {
  id: string;
  name: string;
  category: SupplyCategory;
  filamentType?: FilamentType;
  filaments?: FdmFilamentLine[];
  resinType?: ResinType | string;
  brand?: string;
  unit: string;
  quantity: number;
  minStock: number;
  unitPrice: number;
  priceFromSettings: boolean;
  /** Texto libre legacy; se mantiene sincronizado con el nombre del proveedor. */
  supplier?: string;
  /** Id de la colección `suppliers`. */
  supplierId?: string;
  /** Peso por bobina en gramos (filamentos; default 1000 si null). */
  spoolGrams?: number | null;
  colorId?: string;
  /** Historial del precio unitario (precio NUEVO en cada cambio). Máx. 50. */
  priceHistory?: SupplyPriceHistoryEntry[];
  updatedAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  /** Demora de entrega en días hábiles (lun–vie), 0..60. Default 3. */
  leadTimeBusinessDays: number;
  contact?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type SpoolLocation =
  | { kind: 'printer'; printerId: string; slot: number }
  | { kind: 'shelf'; text: string };

export interface Spool {
  id: string;
  /** Código correlativo global, ej. B-01. Nunca se reutiliza. */
  code: string;
  supplyId: string;
  initialGrams: number;
  remainingGrams: number;
  location: SpoolLocation;
  openedAt: string;
  finishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ReorderStatus = 'urgent' | 'soon' | 'ok';
export type ReorderReason = 'forecast' | 'out_of_stock' | 'below_min';

export interface ReorderRow {
  supplyId: string;
  name: string;
  unit: string;
  stock: number;
  weeklyConsumption: number;
  coversDays: number | null;
  supplier: {
    id: string;
    name: string;
    leadTimeBusinessDays: number;
  } | null;
  orderBy: string | null;
  status: ReorderStatus;
  reason: ReorderReason | null;
  suggestedQuantity: number;
  insufficientData: boolean;
}

export interface ReorderSummary {
  rows: ReorderRow[];
  openSpools: number;
  urgentCount: number;
}

export interface ReorderCounts {
  openSpools: number;
  urgentCount: number;
  total: number;
}

export type SpoolAlert =
  | {
      kind: 'spool_short';
      printerId: string;
      printerName: string;
      slot: number;
      spoolId: string;
      code: string;
      needGrams: number;
      remainingGrams: number;
      jobId: string;
      jobName: string;
    }
  | {
      kind: 'reorder';
      supplyId: string;
      name: string;
      orderBy: string | null;
      coversDays: number | null;
      stock?: number;
      unit?: string;
      stockLabel: string;
      supplierName: string | null;
      leadTimeBusinessDays: number | null;
      reason?: ReorderReason | null;
    };

export interface SupplierOrderDraft {
  supplier: Supplier;
  lines: { name: string; quantity: number; unit: string }[];
  text: string;
}

export interface ConsumedSpoolLine {
  spoolId: string;
  code: string;
  grams: number;
}

export interface PrintJobConsumptionSpoolLine {
  spoolId: string;
  code: string;
  grams: number;
  remainingAfter: number;
}

/** Fila de GET /supplies/price-changes. */
export interface SupplyPriceChangeRow {
  supplyId: string;
  name: string;
  unit: string;
  priceBefore: number;
  priceNow: number;
  variationPercent: number;
  affectedProducts: number;
}

export interface CostBreakdown {
  materialCost: number;
  /** Costo de purga AMS (FDM). Separado del material; entra al margen de error. */
  purgeCost?: number;
  energyCost: number;
  machineCost: number;
  errorMarginCost: number;
  laborCost: number;
  totalCost: number;
}

export interface CalculateCostPayload {
  type: ProductType;
  grams?: number;
  /** Gramos de purga AMS por unidad (FDM). No suman a `grams`. */
  purgeGrams?: number | null;
  printTimeHours?: number;
  workTimeHours?: number;
  brand?: string;
  filamentType?: FilamentType;
  filaments?: FdmFilamentLine[];
  resinType?: ResinType | string;
  washMinutes?: number;
  cureMinutes?: number;
  pressMinutes?: number;
  estampadoPrints?: EstampadoPrintSpec[];
  estampadoPressCycles?: EstampadoPressCycle[];
  estampadoSupplies?: EstampadoSupplyLine[];
  /** Impresora preferida del producto: perfil print para luz/máquina si es válido. */
  preferredPrinterId?: string | null;
}

export interface ProductPricingInput {
  type: ProductType;
  components?: ProductComponent[];
  assemblyTimeHours?: number;
  suggestedPrice?: number | null;
  price?: number;
  cost?: number;
  grams?: number;
  purgeGrams?: number | null;
  printTimeHours?: number;
  workTimeHours?: number;
  brand?: string;
  filamentType?: FilamentType;
  filaments?: FdmFilamentLine[];
  resinType?: ResinType | string;
  washMinutes?: number;
  cureMinutes?: number;
  pressMinutes?: number;
  estampadoPrints?: EstampadoPrintSpec[];
  estampadoPressCycles?: EstampadoPressCycle[];
  estampadoSupplies?: EstampadoSupplyLine[];
  /** Impresora preferida del producto: perfil print para luz/máquina si es válido. */
  preferredPrinterId?: string | null;
}

export interface ProductPricingResult {
  cost: number;
  price: number;
  profit: number;
  marginPercent: number;
  configuredMarginPercent?: number;
  breakdown: CostBreakdown | null;
}

export interface ProductPricingFields {
  id: string;
  price: number;
  cost: number;
  profit: number;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  productTypes: ProductType[];
  createdAt: string;
}

export interface ProductComponent {
  productId: string;
  quantity: number;
  colorId?: string;
}

export interface ProductAttachment {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  size: number;
}

export interface ProductBase {
  id: string;
  name: string;
  /** Texto libre del catálogo. No es obligatorio. */
  description?: string;
  images: string[];
  attachments: ProductAttachment[];
  updatedAt: string;
  price: number;
  cost: number;
  profit: number;
  /** Precio manual del catálogo; si está seteado, no se pisa al recalcular. */
  suggestedPrice?: number | null;
  categoryIds: string[];
  type: ProductType;
  size: string;
  /** Visible en el catálogo general; los internos siguen disponibles en piezas y presupuestos */
  published: boolean;
  /** Si true, el costo se calcula desde piezas incluidas */
  includesPieces: boolean;
  components: ProductComponent[];
  assemblyTimeHours: number;
  /** Stock físico de producto terminado (contrato API). */
  stock?: number;
  /** Disponible descontando reservas. Lo calcula el API y no se guarda. */
  stockOverview?: ProductStockOverview;
  /** Alias de compatibilidad en UI; preferir `stock` desde el backend. */
  finishedStock?: number;
}

export interface ProductStockOverview {
  physical: number;
  reserved: number;
  available: number;
}

export interface Product3D extends ProductBase {
  type: ProductType.FDM | ProductType.RESINA;
  grams: number;
  printTimeHours: number;
  workTimeHours: number;
  washMinutes?: number;
  cureMinutes?: number;
  brand?: string;
  filamentType?: FilamentType;
  filaments?: FdmFilamentLine[];
  /**
   * Gramos de purga del AMS por unidad (FDM). No entran en `grams`
   * (suma de filas) pero sí al costo y al consumo de stock.
   */
  purgeGrams?: number | null;
  /** Cambios de color del modelo (informativo; suele venir del .3mf). */
  colorChanges?: number | null;
  /**
   * Id de impresora FDM con cola preferida. Si la impresora ya no existe o
   * no tiene cola, al leer se trata como «Cualquiera» (null).
   */
  preferredPrinterId?: string | null;
  resinType?: ResinType | string;
  colorId?: string;
  /** Insumos del producto. Mismo contrato que el estampado: supplyId + cantidad. */
  supplies?: EstampadoSupplyLine[];
}

export interface EstampadoPrintSpec {
  id: string;
  paperType: PaperType;
  impresoId?: string;
  widthCm?: number;
  lengthCm?: number;
  heightCm?: number;
  /** Cantidad de impresos de esta medida/tipo (default 1). */
  quantity?: number;
  label?: string;
}

export interface EstampadoPressCycle {
  id: string;
  pressMinutes: number;
  bajadas: number;
  label?: string;
}

export interface EstampadoSupplyLine {
  id: string;
  supplyId: string;
  quantity: number;
  label?: string;
  colorId?: string;
}

export interface FdmFilamentLine {
  id: string;
  filamentType: FilamentType;
  grams: number;
  brand?: string;
  label?: string;
  colorId?: string;
  /** Origen de la fila; `'3mf'` hasta que el usuario la edite. */
  source?: '3mf' | null;
}

export interface ProductEstampado extends ProductBase {
  type: ProductType.ESTAMPADO;
  workTimeHours?: number;
  prints: EstampadoPrintSpec[];
  pressCycles: EstampadoPressCycle[];
  supplies: EstampadoSupplyLine[];
}

export interface ProductCombo extends ProductBase {
  type: ProductType.COMBO;
}

export type Product = Product3D | ProductEstampado | ProductCombo;

export function isProduct3D(product: Product): product is Product3D {
  return isProductType3D(product.type);
}

export function isProductType3D(type: ProductType): boolean {
  return type === ProductType.FDM || type === ProductType.RESINA;
}

export type CreateProductPayload = (
  | Omit<Product3D, 'id' | 'updatedAt' | 'profit'>
  | Omit<ProductEstampado, 'id' | 'updatedAt' | 'profit'>
  | Omit<ProductCombo, 'id' | 'updatedAt' | 'profit'>
) & {
  suggestedPrice?: number | null;
  includesPieces?: boolean;
  supplies?: EstampadoSupplyLine[];
};

export type UpdateProductPayload = Partial<CreateProductPayload>;

export interface Customer {
  id: string;
  name: string;
  /** Vacío si el cliente no tiene correo. */
  email: string;
  phone: string;
  company?: string;
  /** Particular | Empresa | Revendedor; datos viejos se leen como particular. */
  type: CustomerType;
  /** Compra mínima mayorista (pesos, >= 0); solo aplica a revendedor. */
  wholesaleMinimum?: number;
  /** CUIT opcional, normalizado XX-XXXXXXXX-X. */
  taxId?: string;
  /** Cómo llegó el cliente. */
  source?: CustomerSource;
  createdAt: string;
}

/** Payload alineado con CreateCustomerDto (type/origen opcionales al crear). */
export type CreateCustomerPayload = {
  name: string;
  email?: string;
  phone: string;
  company?: string;
  type?: CustomerType;
  wholesaleMinimum?: number;
  taxId?: string;
  source?: CustomerSource;
};
export type UpdateCustomerPayload = Partial<CreateCustomerPayload>;

export interface OrderItemPayload {
  serviceType: ServiceType;
  productId?: string;
  productName: string;
  quantity: number;
  /** Precio que se cobra (lista o mayorista ya aplicado). */
  unitPrice: number;
  /**
   * Precio de lista de la línea cuando se aplicó mayorista.
   * Ausente = unitPrice es de lista (o no hubo descuento en esa línea).
   */
  listUnitPrice?: number;
  /** Precio unitario editado a mano (persistido). */
  unitPriceManual?: boolean;
  /** Costo unitario al cotizar (snapshot persistido). */
  unitCost?: number;
  includesPrint?: boolean;
  printPaperType?: PaperType;
  printWidthCm?: number;
  printLengthCm?: number;
  printImpresoId?: string;
  designUnitPrice?: number;
  printTimeHours?: number;
  grams?: number;
  filamentType?: FilamentType;
  printProcess?: 'fdm' | 'resina';
  resinType?: ResinType | string;
  washMinutes?: number;
  cureMinutes?: number;
  filaments?: FdmFilamentLine[];
  workTimeHours?: number;
  laborNote?: string;
  estampadoPrints?: EstampadoPrintSpec[];
  estampadoPressCycles?: EstampadoPressCycle[];
  estampadoSupplies?: EstampadoSupplyLine[];
  budgetedHours?: number;
  chargeMode?: 'hours' | 'fixed';
  workKind?: string;
  deliverables?: string[];
  includesRevisions?: boolean;
  needsClientProduct?: boolean;
  linkPrint?: boolean;
}

export interface OrderItem extends OrderItemPayload {
  itemKind?: OrderItemKind;
  fromStock?: number;
  toProduce?: number;
  reserved?: number;
  produced?: number;
  delivered?: number;
  pending?: number;
  reservedQuantity?: number;
  productionRequiredQuantity?: number;
  producedQuantity?: number;
  deliveredQuantity?: number;
  deliveredFromProductionQuantity?: number;
}

export type OrderStatusChangeSource = 'manual' | 'auto';

export interface OrderStatusHistoryEntry {
  id: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  changedAt: string;
  source: OrderStatusChangeSource;
}

export type OrderPriceChangeTrigger =
  | 'settings'
  | 'supply_price'
  | 'product_update'
  | 'bulk_price'
  | 'discount_change';

export interface OrderPriceHistoryEntry {
  id: string;
  changedAt: string;
  trigger: OrderPriceChangeTrigger;
  itemIndex: number;
  productId: string;
  productName: string;
  previousUnitPrice: number;
  newUnitPrice: number;
  previousOrderTotal: number;
  newOrderTotal: number;
  kept?: boolean;
  /** Solo discount_change: descuento anterior y nuevo, ya formateados. */
  previousDiscountLabel?: string;
  newDiscountLabel?: string;
}

export interface Order {
  id: string;
  customerId: string | null;
  customerName: string;
  services: ServiceType[];
  items: OrderItem[];
  status: OrderStatus;
  total: number;
  /** Lista | Mayorista; datos viejos se leen como lista. */
  priceType?: PriceType;
  /** Si el mayorista efectivamente se aplicó. Datos viejos → false. */
  wholesaleApplied?: boolean;
  /** Canal de venta (opcional). */
  salesChannel?: SalesChannel;
  /** uid de Firebase de quien puede mover las tareas de este pedido. */
  responsibleUserId?: string;
  discountPercent?: number;
  discountAmount?: number;
  description?: string;
  /** Archivos e imágenes de referencia (máx. 10). */
  attachments?: ProductAttachment[];
  notes?: string;
  createdAt: string;
  dueDate: string;
  statusHistory?: OrderStatusHistoryEntry[];
  priceHistory?: OrderPriceHistoryEntry[];
  deliveryHistory?: OrderDelivery[];
  payments?: OrderPayment[];
}

export interface OrderPayment {
  id: string;
  amount: number;
  deposit: boolean;
  createdAt: string;
  /** Medio de pago; datos viejos se leen como efectivo. */
  method?: PaymentMethod;
  /** Cuenta donde entra el dinero; default según el medio. */
  account?: TreasuryAccount;
  /** Comisión del medio en pesos. */
  fee?: number;
  /** Pago anulado: no cuenta en saldo ni cobrado. */
  voidedAt?: string;
  voidReason?: string;
}

export type CreateOrderPaymentPayload = {
  amount: number;
  deposit?: boolean;
  method?: PaymentMethod;
  account?: TreasuryAccount;
  fee?: number;
};

export type CreateOrderPayload = Omit<
  Order,
  | 'id'
  | 'createdAt'
  | 'customerName'
  | 'total'
  | 'status'
  | 'statusHistory'
  | 'customerId'
  | 'items'
  | 'wholesaleApplied'
  | 'priceHistory'
  | 'deliveryHistory'
  | 'payments'
  | 'salesChannel'
> & {
  customerId?: string | null;
  items: OrderItemPayload[];
  /** Null borra el canal guardado. */
  salesChannel?: SalesChannel | null;
};

export type UpdateOrderPayload = Partial<CreateOrderPayload>;

export type QuoteItem = Omit<
  OrderItemPayload,
  never
>;

export interface Quote {
  id: string;
  customerId: string | null;
  customerName: string;
  services: ServiceType[];
  items: QuoteItem[];
  status: QuoteStatus;
  total: number;
  /** Lista | Mayorista; datos viejos se leen como lista. */
  priceType?: PriceType;
  /** Si el mayorista efectivamente se aplicó. Datos viejos → false. */
  wholesaleApplied?: boolean;
  /** Canal de venta (opcional). */
  salesChannel?: SalesChannel;
  discountPercent?: number;
  discountAmount?: number;
  description?: string;
  /** Archivos e imágenes de referencia (máx. 10). */
  attachments?: ProductAttachment[];
  quotedAt: string;
  createdAt: string;
  orderId?: string;
}

export type CreateQuotePayload = {
  customerId?: string | null;
  items: OrderItemPayload[];
  priceType?: PriceType;
  /** Null borra el canal guardado. */
  salesChannel?: SalesChannel | null;
  discountPercent?: number;
  discountAmount?: number;
  description?: string;
  attachments?: ProductAttachment[];
  /** Solo borrador | enviado desde el formulario (Crear vs Guardar borrador). */
  status?: QuoteStatus;
};

export type UpdateQuotePayload = Partial<CreateQuotePayload>;

export interface OrderLineDraft {
  serviceType: ServiceType;
  productId?: string;
  customName?: string;
  /** UI: id local de la línea (vínculos en el form). No se persiste. */
  uiId?: string;
  /**
   * UI: la línea de impresión 3D creada por «Incluir la impresión».
   * No se persiste.
   */
  linkedModelUiId?: string;
  /**
   * UI: el usuario editó Concepto a mano. No se pisa al cambiar producto.
   * No se persiste.
   */
  conceptManual?: boolean;
  quantity: number;
  /**
   * Costo unitario al cotizar (snapshot). Se persiste; al reabrir se usa para
   * margen / «bajo costo» hasta que el usuario cambie inputs de cotización.
   */
  unitCost?: number;
  unitPrice: number;
  /**
   * Precio de lista cuando la API ya aplicó mayorista (unitPrice = cobrado).
   * En el form se edita listUnitPrice ?? unitPrice; al guardar se manda lista.
   */
  listUnitPrice?: number;
  /**
   * El usuario editó el precio unitario a mano.
   * No se pisa al recalcular costo (gramos, etc.). Se persiste.
   */
  unitPriceManual?: boolean;
  includesPrint?: boolean;
  printPaperType?: PaperType;
  printWidthCm?: number;
  printLengthCm?: number;
  printImpresoId?: string;
  designUnitPrice?: number;
  /** Solo diseño+impresión: costo/precio unitario de la impresión (UI). */
  printUnitCost?: number;
  printUnitPrice?: number;
  /** Solo impresión 3D: presupuesto manual FDM/resina. */
  printTimeHours?: number;
  grams?: number;
  filamentType?: FilamentType;
  /** Manual 3D: fdm | resina. Se persiste. */
  printProcess?: 'fdm' | 'resina';
  /** Manual 3D (resina): tipo de resina. Se persiste. */
  resinType?: ResinType | string;
  /** Resina: minutos de lavado (manual o copiados del catálogo). Se persisten. */
  washMinutes?: number;
  /** Resina: minutos de curado (manual o copiados del catálogo). Se persisten. */
  cureMinutes?: number;
  /** Filamentos/colores del desglose 3D (se persisten en el ítem). */
  filaments?: FdmFilamentLine[];
  /**
   * Gramos de purga AMS por unidad (FDM). Entra a la base del margen de error.
   * En product-form se sincroniza desde el FormGroup; en pedidos a medida aún no.
   */
  purgeGrams?: number | null;
  /** Horas de mano de obra del desglose 3D (se persisten). */
  workTimeHours?: number;
  /** Nota de mano de obra (se persiste). */
  laborNote?: string;
  /** Cómo se cobra diseño o modelado (se persiste). */
  chargeMode?: 'hours' | 'fixed';
  /** Tipo de trabajo de diseño (se persiste). */
  workKind?: string;
  /** Entregables de diseño o modelado (se persisten). */
  deliverables?: string[];
  /** Rondas de cambios de diseño (se persiste). */
  includesRevisions?: boolean;
  /** El modelado espera el producto del cliente (se persiste). */
  needsClientProduct?: boolean;
  /**
   * Modelado: incluir impresión de la pieza.
   * Al marcar, el form agrega una línea de Impresión 3D vinculada.
   */
  linkPrint?: boolean;
  /** Solo estampado personalizado (sin catálogo). */
  estampadoPrints?: EstampadoPrintSpec[];
  estampadoPressCycles?: EstampadoPressCycle[];
  estampadoSupplies?: EstampadoSupplyLine[];
  /** Horas presupuestadas de diseño o modelado. */
  budgetedHours?: number;
}

export interface PrintJobFailure {
  id: string;
  at: string;
  userId?: string;
  pieces: number;
  grams: number;
  hours: number;
  reason: 'despegue' | 'enredo' | 'corte_luz' | 'atasco' | 'otro';
  cost: number;
}

export interface PrintJobConsumptionLine {
  supplyId: string | null;
  name: string;
  /** Etiqueta del requisito (ej. «PLA · 20 g por unidad»), si aporta. */
  requirementLabel?: string | null;
  quantity: number;
  unit: string;
  remaining: number | null;
  kind: 'material' | 'failure';
  colorId?: string | null;
  colorHex?: string | null;
  /** Reparto previsto por bobina (dryRun de allocate). */
  spools?: PrintJobConsumptionSpoolLine[];
}

export interface PrintJobFailureStats {
  prints: number;
  failed: number;
  failedPercent: number | null;
  lostGrams: number;
  lostCost: number;
  errorMarginPercent: number;
  suggestedPercent: number | null;
}

export interface PrintJob {
  id: string;
  orderId: string;
  orderItemIndex: number;
  customerName: string;
  productName: string;
  productId?: string;
  /** `''` cuando la tarea interna no tiene área designada. */
  type: ServiceType | '';
  taskKind: TaskKind;
  quantity?: number;
  status: PrintJobStatus;
  active: boolean;
  archived?: boolean;
  priority: number;
  machine: string;
  estimatedHours: number;
  dueDate: string;
  startedAt?: string;
  completedAt?: string;
  blockedReason?: string;
  responsibleUserId?: string;
  /** Id de MachineProfile (role=print, queueEnabled). null/ausente = sin asignar. */
  printerId?: string | null;
  /** Orden manual dentro de la cola de esa impresora (0..n-1). */
  queuePosition?: number | null;
  notes?: string;
  actualHours?: number | null;
  /** Si está seteado, `priority` = este valor; si no, se calcula por dueDate. */
  priorityOverride?: number | null;
  /** Prioridad por dueDate sin override (API). */
  calculatedPriority?: number;
  /** Si true, el sync del pedido no pisa responsibleUserId. */
  responsibleManual?: boolean;
  failures?: PrintJobFailure[];
  /** Id de la tarea original si esta es una reimpresión por falla. */
  reprintOfJobId?: string | null;
  /** Momento en que se descontó stock al terminar (una sola vez). */
  consumedAt?: string | null;
  /** Bobinas de las que se descontó al terminar. */
  consumedSpools?: ConsumedSpoolLine[];
}

/** Ranura AMS en la cola por impresora (derivada de bobinas abiertas). */
export interface AmsSlot {
  slot: number;
  spoolId: string | null;
  code: string | null;
  color: { id: string; name: string; hex: string } | null;
  remainingGrams: number | null;
}

/** @deprecated Usar AmsSlot; se mantiene por compat de imports. */
export type PrinterQueueColorSlot = {
  id: string;
  name: string;
  hex: string;
};

export interface PrinterQueueProfile {
  id: string;
  name: string;
  amsType: string | null;
  amsSlots: AmsSlot[];
  workHoursPerDay: number;
  workWeekdays: number[];
  workStartHour: string;
}

export interface PrinterJobSchedule {
  jobId: string;
  start: string | null;
  end: string | null;
  progress: number | null;
  blocked: boolean;
  readyDate: string | null;
  late: boolean;
  overdue: boolean;
}

export type PrinterQueueJob = PrintJob & {
  colors: ColorConfig[];
  schedule?: PrinterJobSchedule | null;
};

export interface PrinterQueueLane {
  profile: PrinterQueueProfile;
  busyUntil: string | null;
  queuedHours: number;
  printing: boolean;
  loadPct: number;
  jobs: PrinterQueueJob[];
}

export interface PrinterQueueOtherArea {
  area: string;
  count: number;
  hours: number;
}

export interface PrinterQueueResponse {
  printers: PrinterQueueLane[];
  unassigned: PrinterQueueJob[];
  otherAreas: PrinterQueueOtherArea[];
}

export interface DeliveryEstimate {
  date: string;
  printerId: string;
}

export interface PrinterCapacityRow {
  printerId: string;
  name: string;
  hoursByDay: number[];
  full: boolean[];
  freeHours: number;
}

export interface PrinterCapacity {
  days: string[];
  printers: PrinterCapacityRow[];
}

export interface SupplyShortageLine {
  key: string;
  label: string;
  category: string;
}

export interface SupplyReplacementCandidate {
  id: string;
  name: string;
  category: string;
  detail: string;
}

export interface SupplyShortageReport {
  missing: SupplyShortageLine[];
  candidates: SupplyReplacementCandidate[];
}

export interface SupplyReplacementChoice {
  requirementKey: string;
  supplyId: string;
}

export interface UpdatePrintJobPayload {
  status?: PrintJobStatus;
  active?: boolean;
  supplyReplacements?: SupplyReplacementChoice[];
  notes?: string | null;
  actualHours?: number | null;
  priority?: 'alta' | 'normal';
  blockedReason?: string;
  responsibleUserId?: string | null;
}

export interface RegisterPrintJobFailurePayload {
  pieces: number;
  grams: number;
  hours: number;
  reason: PrintJobFailure['reason'];
  reprint?: boolean;
}

export interface PrintJobFailureResult {
  job: PrintJob;
  reprint?: PrintJob;
}

export interface PrintJobUpdateResult extends PrintJob {
  orderStatus: OrderStatus;
  stockWarnings?: string[];
}

export interface OrderPriceNotice {
  itemIndex: number;
  productId: string;
  productName: string;
  agreedUnitPrice: number;
  currentUnitPrice: number;
}

export interface OrderOverview {
  order: Order;
  tasks: PrintJob[];
  alerts: OrderAlert[];
  deliveries?: OrderDelivery[];
  priceNotices?: OrderPriceNotice[];
}

export interface ProductOverview {
  product: Product;
  categories: Category[];
  catalogProducts: Product[];
  stock: ProductStockOverview;
}

export interface OrderAlert {
  code: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  itemIndex?: number;
}

export interface OrderDeliveryItem {
  orderItemIndex: number;
  quantity: number;
}

export interface OrderDelivery {
  id: string;
  orderId?: string;
  items: OrderDeliveryItem[];
  deliveredAt: string;
  notes?: string;
}

export interface CreateOrderDeliveryPayload {
  items: OrderDeliveryItem[];
  notes?: string;
}

export interface PrintJobsBoard {
  jobs: PrintJob[];
  orderStatuses: Record<string, OrderStatus>;
}

export interface ReferenceData {
  customers: Customer[];
  categories: Category[];
  products: Product[];
}

export interface MonthlyTrendPoint {
  month: string;
  label: string;
  ordersCount: number;
  revenue: number;
  /** Cobrado en el mes (pagos netos + mostrador), mismo criterio que profitability.collected. */
  collected: number;
}

/** Período calendario del dashboard de rentabilidad. */
export type DashboardPeriod = 'month' | 'quarter' | 'year';

export type DashboardRankBy = 'profit' | 'markup' | 'units';

export interface DashboardProfitabilityChannel {
  channel: string;
  sold: number;
  cost: number;
  profit: number;
  markupPercent: number | null;
}

export interface DashboardProfitabilityRankingItem {
  productId: string;
  productName: string;
  units: number;
  profitPerUnit: number;
  markupPercent: number | null;
  totalProfit: number;
  mainChannel: string;
  fixedPrice: boolean;
}

export interface DashboardMarginAlert {
  productId: string;
  name: string;
  price: number;
  cost: number;
  markupPercent: number;
  targetPercent: number;
  priceForTarget: number;
  fixedPrice: boolean;
}

/** Alias del shape de GET /products/margin-alerts. */
export type ProductMarginAlert = DashboardMarginAlert;

export interface DashboardProfitability {
  period: DashboardPeriod;
  from: string;
  to: string;
  sold: number;
  collected: number;
  fees: number;
  netProfit: number;
  receivable: number;
  receivableOrders: number;
  byChannel: DashboardProfitabilityChannel[];
  ranking: DashboardProfitabilityRankingItem[];
  marginAlerts: DashboardMarginAlert[];
}

export type DashboardNotificationType = 'info' | 'warning' | 'success';

export type DashboardNotificationKind =
  | 'order'
  | 'stock'
  | 'queue'
  | 'calendar'
  | 'other';

export interface DashboardNotification {
  id: string;
  type: DashboardNotificationType;
  kind: DashboardNotificationKind;
  title: string;
  message: string;
  route?: string;
  areas?: ServiceType[];
}

export interface ClientReceivableOrder {
  id: string;
  amount: number;
  total: number;
  deliveredAt: string;
  summary: string;
}

export interface ClientReceivable {
  customerId: string;
  customerName: string;
  phone?: string;
  company?: string;
  amount: number;
  orders: ClientReceivableOrder[];
}

/** Insumo con stock bajo: mismo criterio que el KPI (quantity <= minStock). */
export interface DashboardLowStockItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  minStock: number;
}

export interface DashboardStats {
  totalOrders: number;
  pendingOrders: number;
  overdueOrders: number;
  /** Atrasados que todavía están en estado pendiente. */
  overduePendingOrders: number;
  inProductionOrders: number;
  monthlyRevenue: number;
  walletBalance: number;
  clientDebt: number;
  receivables: ClientReceivable[];
  activePrintJobs: number;
  queuedPrintJobs: number;
  totalCustomers: number;
  lowStockMaterials: number;
  /** Misma lista que alimenta lowStockMaterials (quantity <= minStock). */
  lowStockItems: DashboardLowStockItem[];
  ordersByType: { type: ServiceType; count: number }[];
  recentOrders: Order[];
  monthlyTrend: MonthlyTrendPoint[];
  notifications: DashboardNotification[];
  profitability: DashboardProfitability;
}

export interface DashboardStatsQuery {
  period?: DashboardPeriod;
  rankBy?: DashboardRankBy;
}

export interface TreasuryExpense {
  id: string;
  direction: TreasuryMovementDirection;
  category: TreasuryExpenseCategory;
  name: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  description?: string;
  referenceId?: string;
  /** Cuenta afectada; datos viejos → caja. */
  account?: TreasuryAccount;
  voidedAt?: string;
  voidReason?: string;
  occurredAt: string;
  createdAt: string;
}

export type TreasuryMovementSource = 'order_payment' | 'retail_sale' | 'record';

export interface TreasuryMovement {
  id: string;
  source: TreasuryMovementSource;
  occurredAt: string;
  concept: string;
  detail?: string;
  account?: TreasuryAccount;
  method?: PaymentMethod;
  /** Importe con signo (ingreso +, egreso −). */
  amount: number;
  fee: number;
  net: number;
  voided: boolean;
  voidedAt?: string;
  voidReason?: string;
  orderId?: string;
  recordId?: string;
}

export interface TreasuryAccountBalance {
  account: TreasuryAccount;
  balance: number;
  fees: number;
}

export interface TreasuryDebtorBalance {
  name: string;
  amount: number;
}

export interface TreasuryOverview {
  availableBalance: number;
  totalIncome: number;
  totalExpenses: number;
  totalSalesIncome: number;
  totalManualIncome: number;
  accounts: TreasuryAccountBalance[];
  movements: TreasuryMovement[];
  expenses: TreasuryExpense[];
  recordNameSuggestions: string[];
  recipientNameSuggestions: string[];
  debtors: TreasuryDebtorBalance[];
}

export interface CreateTreasuryExpensePayload {
  name?: string;
  isSupplyPurchase: boolean;
  direction?: TreasuryMovementDirection;
  category?: TreasuryExpenseCategory;
  amount: number;
  occurredAt: string;
  account?: TreasuryAccount;
  supplyLines?: CreateTreasurySupplyLinePayload[];
}

export interface CreateTreasurySupplyLinePayload {
  supplyId: string;
  quantity: number;
  amountSpent: number;
  unitPrice: number;
}

export interface UpdateTreasuryExpensePayload {
  name?: string;
  direction?: TreasuryMovementDirection;
  amount?: number;
  occurredAt?: string;
  quantity?: number;
  unitPrice?: number;
  account?: TreasuryAccount;
}

export interface VoidTreasuryExpensePayload {
  reason: string;
}

export interface CreateTreasuryTransferPayload {
  from: TreasuryAccount;
  to: TreasuryAccount;
  amount: number;
  occurredAt: string;
}

export interface RetailSaleItem {
  productId?: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface RetailSale {
  id: string;
  items: RetailSaleItem[];
  total: number;
  discountPercent?: number;
  discountAmount?: number;
  notes?: string;
  method?: PaymentMethod;
  account?: TreasuryAccount;
  soldAt: string;
  createdAt: string;
}

export type CreateRetailSaleItemPayload = {
  productId?: string;
  productName?: string;
  quantity: number;
  unitPrice: number;
};

export type CreateRetailSalePayload = {
  items: CreateRetailSaleItemPayload[];
  notes?: string;
  soldAt?: string;
  discountPercent?: number;
  discountAmount?: number;
  method?: PaymentMethod;
  account?: TreasuryAccount;
};

export type UpdateRetailSalePayload = Partial<CreateRetailSalePayload>;

export interface SaleEntryItem {
  productId?: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  serviceType?: ServiceType;
  printTimeHours?: number;
  grams?: number;
  filamentType?: FilamentType;
  workTimeHours?: number;
  printProcess?: 'fdm' | 'resina';
  resinType?: ResinType | string;
  washMinutes?: number;
  cureMinutes?: number;
}

export type ProfitArea =
  | ServiceType.IMPRESION_3D
  | ServiceType.DISENO_GRAFICO
  | ServiceType.MODELADO
  | ServiceType.ESTAMPADO;

export interface AreaProfitSourceBreakdown {
  revenue: number;
  cost: number;
  profit: number;
}

export interface AreaProfitBalance {
  area: ProfitArea;
  revenue: number;
  cost: number;
  profit: number;
  retail: AreaProfitSourceBreakdown;
  orders: AreaProfitSourceBreakdown;
}

export interface SaleEntry {
  id: string;
  source: SaleSource;
  saleId: string;
  customerName?: string;
  items: SaleEntryItem[];
  total: number;
  cost: number;
  profit: number;
  soldAt: string;
  notes?: string;
  orderId?: string;
  retailSaleId?: string;
  /** Canal del pedido; ausente en mostrador o pedidos sin canal. */
  salesChannel?: SalesChannel;
  editable: boolean;
}

export type BulkPriceScope = 'all' | 'category' | 'filament_type';

export interface BulkPricePayload {
  scope: BulkPriceScope;
  categoryId?: string;
  /** Id del catálogo `filamentTypes` de ajustes (no el enum legado). */
  filamentType?: string;
  percent: number;
  roundTo: 0 | 100 | 500;
}

export interface BulkPricePreviewItem {
  productId: string;
  name: string;
  currentPrice: number;
  newPrice: number;
  newWholesalePrice: number;
  cost: number;
  newMarkupPercent: number | null;
}

export interface BulkPricePreviewResult {
  items: BulkPricePreviewItem[];
  count: number;
}

export interface SalesStats {
  monthlyRevenue: number;
  monthlyCost: number;
  monthlyProfit: number;
  monthlyOrdersRevenue: number;
  monthlyRetailRevenue: number;
  monthlyOrdersCost: number;
  monthlyRetailCost: number;
  monthlyOrdersProfit: number;
  monthlyRetailProfit: number;
  monthlyOrdersCount: number;
  monthlyRetailCount: number;
  profitByArea: AreaProfitBalance[];
}

export interface SalesOverview {
  stats: SalesStats;
  entries: SaleEntry[];
}

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

export interface WorkArea {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface RolePermissionEntry {
  action: PermissionAction;
  areaId: string | null;
}

export interface AppRole {
  id: string;
  name: string;
  description?: string;
  isSystem: boolean;
  permissions: RolePermissionEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface UserPermissionOverrideEntry {
  action: PermissionAction;
  areaId: string | null;
  granted: boolean;
}

export interface AppUser {
  id: string;
  firebaseUid?: string;
  email: string;
  displayName: string;
  active: boolean;
  roleIds: string[];
  permissionOverrides: UserPermissionOverrideEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface ResolvedPermissionEntry {
  action: PermissionAction;
  areaId: string | null;
  granted: boolean;
}

export interface CurrentUserProfile extends AppUser {
  roles: AppRole[];
  permissions: ResolvedPermissionEntry[];
  isAdmin: boolean;
}

export type CurrentUserResponse = CurrentUserProfile | { authenticated: false };
