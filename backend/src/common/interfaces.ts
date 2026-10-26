import {
  BrandMaterialType,
  FilamentType,
  OrderStatus,
  PaperType,
  PrintJobStatus,
  QuoteStatus,
  MachineProfileRole,
  ProductType,
  ResinType,
  SaleSource,
  ServiceType,
  SupplyCategory,
  TaskType,
  TreasuryExpenseCategory,
  TreasuryMovementDirection,
} from './enums';

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

export interface FilamentPriceConfig {
  id: string;
  brandId?: string;
  /** Nombre hidratado desde la tabla de marcas. No es el dato que se guarda. */
  brand?: string;
  materialType: FilamentType;
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
  resinType: ResinType;
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
  paperPricesPerSqm: PaperPricesPerSqm;
  paperReferenceSheets: PaperReferenceSheets;
  filamentPrices: FilamentPriceConfig[];
  resinPrices: ResinPriceConfig[];
  /** Precio $/kg por tipo; usado al costear productos FDM (sin marca). */
  filamentTypeAverages: Partial<Record<FilamentType, number>>;
  /** Precio $/L por tipo; usado al costear productos resina (sin marca). */
  resinTypeAverages: Partial<Record<ResinType, number>>;
  colors: ColorConfig[];
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

export interface Supply {
  id: string;
  name: string;
  category: SupplyCategory;
  filamentType?: FilamentType;
  resinType?: ResinType;
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
  resinType?: ResinType;
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
  resinType?: ResinType;
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
  images: string[];
  attachments: ProductAttachment[];
  updatedAt: string;
  price: number;
  cost: number;
  profit: number;
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
  resinType?: ResinType;
  colorId?: string;
}

export interface EstampadoPrintSpec {
  id: string;
  paperType: PaperType;
  impresoId?: string;
  widthCm?: number;
  lengthCm?: number;
  heightCm?: number;
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
  email: string;
  phone: string;
  company?: string;
  createdAt: string;
}

export interface OrderItem {
  serviceType: ServiceType;
  productId?: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  includesPrint?: boolean;
  printPaperType?: PaperType;
  printWidthCm?: number;
  printLengthCm?: number;
  printImpresoId?: string;
  designUnitPrice?: number;
  printTimeHours?: number;
  grams?: number;
  filamentType?: FilamentType;
  budgetedHours?: number;
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
  | 'settings'
  | 'supply_price'
  | 'product_update';

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
  discountPercent?: number;
  discountAmount?: number;
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
  type: ServiceType;
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
}

export interface UpdatePrintJobDto {
  status?: PrintJobStatus;
  active?: boolean;
  responsibleUserId?: string;
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
}

export type DashboardNotificationType = 'info' | 'warning' | 'success';

export type DashboardNotificationKind = 'order' | 'stock' | 'queue' | 'other';

export interface DashboardNotification {
  id: string;
  type: DashboardNotificationType;
  kind: DashboardNotificationKind;
  title: string;
  message: string;
  route?: string;
  areas?: ServiceType[];
}

export interface DashboardStats {
  totalOrders: number;
  pendingOrders: number;
  overdueOrders: number;
  inProductionOrders: number;
  monthlyRevenue: number;
  walletBalance: number;
  activePrintJobs: number;
  queuedPrintJobs: number;
  totalCustomers: number;
  lowStockMaterials: number;
  ordersByType: { type: ServiceType; count: number }[];
  recentOrders: Order[];
  monthlyTrend: MonthlyTrendPoint[];
  notifications: DashboardNotification[];
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
  occurredAt: string;
  createdAt: string;
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
  expenses: TreasuryExpense[];
  recordNameSuggestions: string[];
  recipientNameSuggestions: string[];
  debtors: TreasuryDebtorBalance[];
}

export interface MonthlyTrendPoint {
  month: string;
  label: string;
  ordersCount: number;
  revenue: number;
}

/** Payload de creación/actualización alineado con el DTO HTTP. */
export type CreateProductDto = {
  name: string;
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
  resinType?: ResinType;
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
