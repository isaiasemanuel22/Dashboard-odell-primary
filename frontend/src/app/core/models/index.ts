export enum ServiceType {
  IMPRESION_3D = 'impresion_3d',
  DISENO = 'diseno',
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
}

export interface GeneralSettings {
  electricityCostPerKwh: number;
  /** % sobre material + energía + máquina, aplicado al costo de producto. */
  errorMarginPercent: number;
  powerConsumptions: PowerConsumptionConfig[];
  machineCosts: MachineCostConfig[];
  laborCostPerHour: number;
  profitMargins: ServiceProfitMargins;
  paperPricesPerSqm: PaperPricesPerSqm;
  filamentPrices: FilamentPriceConfig[];
  resinPrices: ResinPriceConfig[];
  /** Precio $/kg por tipo; usado al costear productos FDM (sin marca). */
  filamentTypeAverages: Partial<Record<FilamentType, number>>;
  /** Precio $/L por tipo; usado al costear productos resina (sin marca). */
  resinTypeAverages: Partial<Record<ResinType, number>>;
  machineProfiles: MachineProfile[];
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

export interface CalculateCostPayload {
  type: ProductType;
  grams?: number;
  printTimeHours?: number;
  workTimeHours?: number;
  brand?: string;
  filamentType?: FilamentType;
  resinType?: ResinType;
  washMinutes?: number;
  cureMinutes?: number;
  pressMinutes?: number;
  estampadoPrints?: EstampadoPrintSpec[];
  estampadoPressCycles?: EstampadoPressCycle[];
  estampadoSupplies?: EstampadoSupplyLine[];
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
  brand?: string;
  filamentType?: FilamentType;
  resinType?: ResinType;
  washMinutes?: number;
  cureMinutes?: number;
  pressMinutes?: number;
  estampadoPrints?: EstampadoPrintSpec[];
  estampadoPressCycles?: EstampadoPressCycle[];
  estampadoSupplies?: EstampadoSupplyLine[];
}

export interface ProductPricingResult {
  cost: number;
  price: number;
  profit: number;
  marginPercent: number;
  configuredMarginPercent?: number;
  breakdown: CostBreakdown | null;
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
  /** Si true, el costo se calcula desde piezas incluidas */
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
  pressMinutes: number;
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
  email: string;
  phone: string;
  company?: string;
  createdAt: string;
}

export type CreateCustomerPayload = Omit<Customer, 'id' | 'createdAt'>;
export type UpdateCustomerPayload = Partial<CreateCustomerPayload>;

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

export type CreateOrderPayload = Omit<
  Order,
  'id' | 'createdAt' | 'customerName' | 'total' | 'statusHistory'
>;

export type UpdateOrderPayload = Partial<CreateOrderPayload>;

export interface OrderLineDraft {
  serviceType: ServiceType;
  productId?: string;
  customName?: string;
  quantity: number;
  unitPrice: number;
}

export interface PrintJob {
  id: string;
  orderId: string;
  orderItemIndex: number;
  customerName: string;
  productName: string;
  productId?: string;
  type: ServiceType;
  status: PrintJobStatus;
  active: boolean;
  priority: number;
  machine: string;
  estimatedHours: number;
  dueDate: string;
  startedAt?: string;
  completedAt?: string;
}

export interface UpdatePrintJobPayload {
  status?: PrintJobStatus;
  active?: boolean;
}

export interface PrintJobUpdateResult extends PrintJob {
  orderStatus: OrderStatus;
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
};

export type UpdateRetailSalePayload = Partial<CreateRetailSalePayload>;

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
