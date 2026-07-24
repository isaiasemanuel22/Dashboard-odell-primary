import {
  FilamentType,
  OrderStatus,
  PaperType,
  PrintJobStatus,
  MachineProfileRole,
  ProductType,
  ResinType,
  SaleSource,
  ServiceType,
  SupplyCategory,
  SupplyType,
} from './enums';

export interface Category {
  id: string;
  name: string;
  productTypes: ProductType[];
  createdAt: string;
}

export interface FilamentPriceConfig {
  id: string;
  brand: string;
  materialType: FilamentType;
  pricePerKg: number;
}

export interface ResinPriceConfig {
  id: string;
  brand: string;
  resinType: ResinType;
  pricePerLiter: number;
}

export interface PaperPricesPerSqm {
  sublimacion: number;
  dtf: number;
  dtfUv: number;
}

/** Margen de ganancia sobre el costo (%), por tipo de servicio. */
export interface ServiceProfitMargins {
  impresion_3d: number;
  diseno: number;
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
  profitMargins: ServiceProfitMargins;
  paperPricesPerSqm: PaperPricesPerSqm;
  filamentPrices: FilamentPriceConfig[];
  resinPrices: ResinPriceConfig[];
  /** Precio $/kg por tipo; usado al costear productos FDM (sin marca). */
  filamentTypeAverages: Partial<Record<FilamentType, number>>;
  /** Precio $/L por tipo; usado al costear productos resina (sin marca). */
  resinTypeAverages: Partial<Record<ResinType, number>>;
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
  type: SupplyType;
  filamentType?: FilamentType;
  resinType?: ResinType;
  brand?: string;
  unit: string;
  quantity: number;
  minStock: number;
  unitPrice: number;
  priceFromSettings: boolean;
  supplier?: string;
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

export interface ProductComponent {
  productId: string;
  quantity: number;
}

export interface ProductBase {
  id: string;
  name: string;
  images: string[];
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
  resinType?: ResinType;
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
}

export interface OrderOverview {
  order: Order;
  tasks: PrintJob[];
}

export interface ProductOverview {
  product: Product;
  categories: Category[];
  catalogProducts: Product[];
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
  status: PrintJobStatus;
  /** Si true, la tarea está en el tablero de trabajo activo. */
  active: boolean;
  priority: number;
  machine: string;
  estimatedHours: number;
  dueDate: string;
  startedAt?: string;
  completedAt?: string;
}

export interface UpdatePrintJobDto {
  status?: PrintJobStatus;
  active?: boolean;
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
  monthlyOrdersCount: number;
  monthlyRetailCount: number;
}

export interface SalesOverview {
  stats: SalesStats;
  entries: SaleEntry[];
}

export interface Material {
  id: string;
  name: string;
  type: ServiceType;
  quantity: number;
  unit: string;
  minStock: number;
  supplier: string;
}

export interface DashboardStats {
  totalOrders: number;
  pendingOrders: number;
  inProductionOrders: number;
  monthlyRevenue: number;
  activePrintJobs: number;
  queuedPrintJobs: number;
  totalCustomers: number;
  lowStockMaterials: number;
  ordersByType: { type: ServiceType; count: number }[];
  recentOrders: Order[];
  monthlyTrend: MonthlyTrendPoint[];
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
  resinType?: ResinType;
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
};

export type UpdateProductDto = Partial<CreateProductDto>;
