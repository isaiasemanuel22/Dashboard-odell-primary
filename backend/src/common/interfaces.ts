import {
  BrandMaterialType,
  CalendarEntryKind,
  CalendarLinkType,
  CalendarNotify,
  CalendarRepeat,
  CustomerSource,
  CustomerType,
  FilamentType,
  OrderStatus,
  PaperType,
  PriceType,
  PrintJobStatus,
  QuoteStatus,
  MachineProfileRole,
  ProductType,
  ResinType,
  PaymentMethod,
  SaleSource,
  SalesChannel,
  ServiceType,
  SupplyCategory,
  TaskType,
  TreasuryAccount,
  TreasuryExpenseCategory,
  TreasuryMovementDirection,
} from './enums';
import type { DashboardPeriod } from './utils/month-range.util';

export type { DashboardPeriod };

export interface Category {
  id: string;
  name: string;
  productTypes: ProductType[];
  createdAt: string;
}

export interface Brand {
  id: string;
  name: string;
  materialTypes: BrandMaterialType[];
  createdAt: string;
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
  brandId?: string;
  /** Nombre hidratado desde la tabla de marcas. No es el dato que se guarda. */
  brand?: string;
  /** Id del catálogo `filamentTypes`. */
  filamentTypeId?: string;
  /**
   * Código/slug usado en productos e insumos (p. ej. pla).
   * Se deriva del tipo del catálogo al guardar el precio.
   */
  materialType: FilamentType | string;
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
  brandId?: string;
  /** Nombre hidratado desde la tabla de marcas. No es el dato que se guarda. */
  brand?: string;
  /** Id del catálogo `resinTypes`. */
  resinTypeId?: string;
  /**
   * Código/slug usado en productos e insumos (p. ej. estandar).
   * Se deriva del tipo del catálogo al guardar el precio.
   */
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
  /** Nombre del equipo */
  name: string;
  role: MachineProfileRole;
  watts: number;
  costPerHour: number;
  /** Ausente = aplica a todos los tipos de producto */
  productType?: ProductType;
  /** Insumo usado en lavado (rol wash). */
  washSupplyId?: string;
  /** ml de insumo que carga el baño de lavado. */
  consumptionMl?: number;
  /** Cuántas piezas se lavan con el mismo baño antes de cambiar el insumo. */
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
  /** Solo role=print: hasta 4 ids de ColorConfig; null = ranura vacía. */
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
  machineProfiles: MachineProfile[];
  laborCostPerHour: number;
  /** Tarifa horaria de modelado 3D. */
  modelingRatePerHour: number;
  /** Tarifa horaria de diseño gráfico. */
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
  colors: ColorConfig[];
  /** Catálogo editable de tipos de filamento (Ajustes). */
  filamentTypes: FilamentTypeConfig[];
  /** Catálogo editable de tipos de resina (Ajustes). */
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

export type CreateImpresoDto = Omit<Impreso, 'id' | 'updatedAt'>;
export type UpdateImpresoDto = Partial<CreateImpresoDto>;

export interface SupplyPriceHistoryEntry {
  at: string;
  unitPrice: number;
}

export interface Supply {
  id: string;
  name: string;
  category: SupplyCategory;
  filamentType?: FilamentType;
  resinType?: ResinType | string;
  brandId?: string;
  /** Nombre hidratado desde la tabla de marcas. No es el dato que se guarda. */
  brand?: string;
  unit: string;
  quantity: number;
  minStock: number;
  unitPrice: number;
  priceFromSettings: boolean;
  supplier?: string;
  colorId?: string;
  /** Historial del precio unitario (precio NUEVO en cada cambio). Máx. 50. */
  priceHistory?: SupplyPriceHistoryEntry[];
  updatedAt: string;
}

export interface CostBreakdown {
  materialCost: number;
  energyCost: number;
  machineCost: number;
  errorMarginCost: number;
  laborCost: number;
  totalCost: number;
}

export interface CalculateCostDto {
  type: ProductType;
  grams?: number;
  printTimeHours?: number;
  workTimeHours?: number;
  washMinutes?: number;
  cureMinutes?: number;
  pressMinutes?: number;
  quantity?: number;
  brand?: string;
  filamentType?: FilamentType;
  filaments?: FdmFilamentLine[];
  resinType?: ResinType | string;
  paperType?: PaperType;
  widthCm?: number;
  heightCm?: number;
  estampadoPrints?: EstampadoPrintSpec[];
  estampadoPressCycles?: EstampadoPressCycle[];
  estampadoSupplies?: EstampadoSupplyLine[];
}

export interface ImpresoCostPreview {
  areaSqm: number;
  paperCost: number;
}

export interface ProductPricingInput {
  type: ProductType;
  components?: ProductComponent[];
  assemblyTimeHours?: number;
  suggestedPrice?: number | null;
  price?: number;
  cost?: number;
  grams?: number;
  printTimeHours?: number;
  workTimeHours?: number;
  washMinutes?: number;
  cureMinutes?: number;
  pressMinutes?: number;
  quantity?: number;
  brand?: string;
  filamentType?: FilamentType;
  filaments?: FdmFilamentLine[];
  resinType?: ResinType | string;
  paperType?: PaperType;
  widthCm?: number;
  heightCm?: number;
  estampadoPrints?: EstampadoPrintSpec[];
  estampadoPressCycles?: EstampadoPressCycle[];
  estampadoSupplies?: EstampadoSupplyLine[];
  includesPieces?: boolean;
}

export interface ProductPricingResult {
  cost: number;
  price: number;
  profit: number;
  marginPercent: number;
  /** Margen configurado en Ajustes → Ganancias (% sobre costo). */
  configuredMarginPercent?: number;
  breakdown: CostBreakdown | null;
}

/** Campos de pricing devueltos por GET /products/pricing-fields. */
export interface ProductPricingFields {
  id: string;
  price: number;
  cost: number;
  profit: number;
  updatedAt: string;
}

export interface ProductComponent {
  productId: string;
  quantity: number;
  colorId?: string;
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
  /** Si true, el costo se calcula desde piezas incluidas en lugar de producción directa */
  includesPieces: boolean;
  components: ProductComponent[];
  assemblyTimeHours: number;
  /** Unidades terminadas en stock físico. */
  stock?: number;
  /** Disponible para nuevas operaciones. No se persiste. */
  stockOverview?: ProductStockOverview;
}

export interface Product3D extends ProductBase {
  type: ProductType.FDM | ProductType.RESINA;
  grams: number;
  printTimeHours: number;
  workTimeHours: number;
  washMinutes?: number;
  cureMinutes?: number;
  brandId?: string;
  /** Nombre hidratado desde la tabla de marcas. No es el dato que se guarda. */
  brand?: string;
  filamentType?: FilamentType;
  filaments?: FdmFilamentLine[];
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
  /** Minutos por bajada (ciclo de plancha). */
  pressMinutes: number;
  /** Cantidad de bajadas con esa duración. */
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
  brandId?: string;
  /** Nombre hidratado desde la tabla de marcas. No es el dato que se guarda. */
  brand?: string;
  label?: string;
  colorId?: string;
}

export interface ProductAttachment {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  size: number;
}

export interface ProductEstampado extends ProductBase {
  type: ProductType.ESTAMPADO;
  workTimeHours?: number;
  prints: EstampadoPrintSpec[];
  pressCycles: EstampadoPressCycle[];
  supplies: EstampadoSupplyLine[];
  /** @deprecated Migrado a `prints` / `pressCycles`. */
  pressMinutes?: number;
  paperType?: PaperType;
  impresoId?: string;
  widthCm?: number;
  heightCm?: number;
}

export interface ProductCombo extends ProductBase {
  type: ProductType.COMBO;
}

export type Product = Product3D | ProductEstampado | ProductCombo;

export interface Customer {
  id: string;
  name: string;
  /** Vacío si el cliente no dejó correo. */
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

export interface OrderItem {
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
  /** Impresión 3D manual: fdm | resina. */
  printProcess?: 'fdm' | 'resina';
  /** Impresión 3D manual (o catálogo copiado): tipo de resina. */
  resinType?: ResinType | string;
  /** Impresión 3D (resina): minutos de lavado cotizados. */
  washMinutes?: number;
  /** Impresión 3D (resina): minutos de curado cotizados. */
  cureMinutes?: number;
  /** Impresión 3D: filamentos/colores del desglose. */
  filaments?: FdmFilamentLine[];
  /** Impresión 3D: horas de mano de obra del desglose. */
  workTimeHours?: number;
  /** Impresión 3D: nota de mano de obra. */
  laborNote?: string;
  /** Presupuesto/pedido estampado personalizado (sin producto de catálogo). */
  estampadoPrints?: EstampadoPrintSpec[];
  estampadoPressCycles?: EstampadoPressCycle[];
  estampadoSupplies?: EstampadoSupplyLine[];
  budgetedHours?: number;
  /** Diseño/modelado: cobro por horas o precio fijo. */
  chargeMode?: 'hours' | 'fixed';
  workKind?: string;
  deliverables?: string[];
  includesRevisions?: boolean;
  needsClientProduct?: boolean;
  linkPrint?: boolean;
  deliveredQuantity?: number;
  reservedQuantity?: number;
  productionRequiredQuantity?: number;
  producedQuantity?: number;
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
  'settings' | 'supply_price' | 'product_update' | 'bulk_price';

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
  /** El usuario dejó el precio acordado. No cambia el total del pedido. */
  kept?: boolean;
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
  notes?: string;
  createdAt: string;
  dueDate: string;
  statusHistory?: OrderStatusHistoryEntry[];
  priceHistory?: OrderPriceHistoryEntry[];
  deliveryHistory?: OrderDeliveryHistoryEntry[];
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
}

export type QuoteItem = Omit<
  OrderItem,
  | 'deliveredQuantity'
  | 'reservedQuantity'
  | 'productionRequiredQuantity'
  | 'producedQuantity'
  | 'deliveredFromProductionQuantity'
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
  quotedAt: string;
  createdAt: string;
  orderId?: string;
}

export interface OrderDeliveryLine {
  orderItemIndex: number;
  quantity: number;
}

export interface OrderDeliveryHistoryEntry {
  id: string;
  deliveredAt: string;
  items: OrderDeliveryLine[];
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
  alerts?: OrderAlert[];
  priceNotices?: OrderPriceNotice[];
}

export interface OrderAlert {
  code: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  itemIndex?: number;
}

export interface ProductStockOverview {
  physical: number;
  reserved: number;
  available: number;
}

export interface ProductOverview {
  product: Product;
  categories: Category[];
  catalogProducts: Product[];
  stock: ProductStockOverview;
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

export interface PrintJob {
  id: string;
  orderId: string;
  /** Índice de la línea en order.items que originó la tarea. */
  orderItemIndex: number;
  customerName: string;
  productName: string;
  productId?: string;
  /** `''` cuando la tarea interna no tiene área designada. */
  type: ServiceType | '';
  taskType?: TaskType;
  quantity?: number;
  status: PrintJobStatus;
  /** Si true, la tarea está en el tablero de trabajo activo. */
  active: boolean;
  priority: number;
  machine: string;
  estimatedHours: number;
  dueDate: string;
  startedAt?: string;
  completedAt?: string;
  archived?: boolean;
  blockedReason?: string;
  responsibleUserId?: string;
  suppliesAvailableNotifiedAt?: string;
  /** Reemplazos de material para esta tarea. No cambian el producto. */
  supplyReplacements?: SupplyReplacement[];
  /** Id de MachineProfile (role=print, queueEnabled). null/ausente = sin asignar. */
  printerId?: string | null;
  /** Orden manual dentro de la cola de esa impresora (0..n-1). */
  queuePosition?: number | null;
}

export interface SupplyReplacement {
  requirementKey: string;
  supplyId: string;
}

export interface SupplyShortageLine {
  key: string;
  label: string;
  category: SupplyCategory;
}

export interface SupplyReplacementCandidate {
  id: string;
  name: string;
  category: SupplyCategory;
  detail: string;
}

export interface SupplyShortageReport {
  missing: SupplyShortageLine[];
  candidates: SupplyReplacementCandidate[];
}

export interface UpdatePrintJobDto {
  status?: PrintJobStatus;
  active?: boolean;
  responsibleUserId?: string;
  supplyReplacements?: SupplyReplacement[];
}

/** Quién intenta mover una tarea. `userId` es el uid de Firebase. */
export interface PrintJobActor {
  userId?: string;
  isAdmin?: boolean;
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

export type CreateRetailSaleItemDto = {
  productId?: string;
  productName?: string;
  quantity: number;
  unitPrice: number;
};

export type CreateRetailSaleDto = {
  items: CreateRetailSaleItemDto[];
  notes?: string;
  soldAt?: string;
  discountPercent?: number;
  discountAmount?: number;
  method?: PaymentMethod;
  account?: TreasuryAccount;
};

export type UpdateRetailSaleDto = Partial<CreateRetailSaleDto>;

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

export interface MonthlyTrendPoint {
  month: string;
  label: string;
  ordersCount: number;
  revenue: number;
  /** Cobrado en el mes (pagos netos + mostrador), mismo criterio que profitability.collected. */
  collected: number;
}

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
  'order' | 'stock' | 'queue' | 'calendar' | 'other';

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

export type CalendarFeedType = 'delivery' | 'event' | 'reminder';

export interface CalendarEntry {
  id: string;
  kind: CalendarEntryKind;
  title: string;
  notes?: string;
  /** YYYY-MM-DD */
  date: string;
  startTime?: string;
  endTime?: string;
  allDay: boolean;
  repeat: CalendarRepeat;
  /** 1=Lun … 7=Dom */
  weekdays: number[];
  notify: CalendarNotify;
  linkType?: CalendarLinkType;
  linkId?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

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

/** Payload de creación/actualización alineado con el DTO HTTP. */
export type CreateProductDto = {
  name: string;
  description?: string;
  type: ProductType;
  images?: string[];
  attachments?: ProductAttachment[];
  categoryIds?: string[];
  price?: number;
  cost?: number;
  size?: string;
  published?: boolean;
  includesPieces?: boolean;
  grams?: number;
  printTimeHours?: number;
  workTimeHours?: number;
  brand?: string;
  filamentType?: FilamentType;
  filaments?: FdmFilamentLine[];
  resinType?: ResinType | string;
  colorId?: string;
  washMinutes?: number;
  cureMinutes?: number;
  pressMinutes?: number;
  paperType?: PaperType;
  impresoId?: string;
  widthCm?: number;
  lengthCm?: number;
  heightCm?: number;
  estampadoPrints?: EstampadoPrintSpec[];
  estampadoPressCycles?: EstampadoPressCycle[];
  estampadoSupplies?: EstampadoSupplyLine[];
  prints?: EstampadoPrintSpec[];
  pressCycles?: EstampadoPressCycle[];
  supplies?: EstampadoSupplyLine[];
  assemblyTimeHours?: number;
  /** Precio manual que reemplaza la suma de componentes. */
  suggestedPrice?: number | null;
  components?: ProductComponent[];
  stock?: number;
};

export type UpdateProductDto = Partial<CreateProductDto>;

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
  action: import('./enums').PermissionAction;
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
  action: import('./enums').PermissionAction;
  areaId: string | null;
  granted: boolean;
}

/** Listado chico para elegir responsable. Sin overrides ni secretos. */
export interface OrderResponsibleOption {
  id: string;
  displayName: string;
  firebaseUid: string;
  active: boolean;
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
  action: import('./enums').PermissionAction;
  areaId: string | null;
  granted: boolean;
}

export interface CurrentUserProfile extends AppUser {
  roles: AppRole[];
  permissions: ResolvedPermissionEntry[];
  isAdmin: boolean;
}
