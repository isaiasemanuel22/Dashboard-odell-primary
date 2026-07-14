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

/** Margen de ganancia sobre el precio de venta (%), por tipo de servicio. */
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
  powerConsumptions: PowerConsumptionConfig[];
  machineCosts: MachineCostConfig[];
  machineProfiles: MachineProfile[];
  laborCostPerHour: number;
  profitMargins: ServiceProfitMargins;
  paperPricesPerSqm: PaperPricesPerSqm;
  filamentPrices: FilamentPriceConfig[];
  resinPrices: ResinPriceConfig[];
}

export interface Impreso {
  id: string;
  name: string;
  paperType: PaperType;
  widthCm: number;
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
}

export interface ProductPricingResult {
  cost: number;
  price: number;
  profit: number;
  marginPercent: number;
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

export interface ProductEstampado extends ProductBase {
  type: ProductType.ESTAMPADO;
  pressMinutes?: number;
  workTimeHours?: number;
}

export type Product = Product3D | ProductEstampado;

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

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  services: ServiceType[];
  items: OrderItem[];
  status: OrderStatus;
  total: number;
  description?: string;
  notes?: string;
  createdAt: string;
  dueDate: string;
  statusHistory?: OrderStatusHistoryEntry[];
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
  notes?: string;
  soldAt: string;
  createdAt: string;
}

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
  soldAt: string;
  notes?: string;
  orderId?: string;
  retailSaleId?: string;
  editable: boolean;
}

export interface SalesStats {
  monthlyRevenue: number;
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

