import { Injectable } from '@nestjs/common';
import {
  Brand,
  CalendarEntry,
  Category,
  Customer,
  GeneralSettings,
  Impreso,
  Order,
  PrintJob,
  Product,
  Quote,
  RetailSale,
  Supply,
  TreasuryExpense,
} from '../common/interfaces';
import { createSeedState } from './store.seed';
import { StoreState } from './store.state';
import {
  removeFromCollection,
  replaceInCollection,
} from './store-collection.util';

@Injectable()
export class StoreService {
  generalSettings!: GeneralSettings;
  brands: Brand[] = [];
  supplies: Supply[] = [];
  impresos: Impreso[] = [];
  categories: Category[] = [];
  products: Product[] = [];
  customers: Customer[] = [];
  orders: Order[] = [];
  quotes: Quote[] = [];
  printJobs: PrintJob[] = [];
  retailSales: RetailSale[] = [];
  treasuryExpenses: TreasuryExpense[] = [];
  calendarEntries: CalendarEntry[] = [];

  private categoryIndexLen = -1;
  private productIndexLen = -1;
  private customerIndexLen = -1;
  private orderIndexLen = -1;
  private quoteIndexLen = -1;
  private printJobIndexLen = -1;
  private supplyIndexLen = -1;
  private impresoIndexLen = -1;
  private retailSaleIndexLen = -1;

  private categoryById = new Map<string, Category>();
  private productById = new Map<string, Product>();
  private customerById = new Map<string, Customer>();
  private orderById = new Map<string, Order>();
  private quoteById = new Map<string, Quote>();
  private printJobById = new Map<string, PrintJob>();
  private supplyById = new Map<string, Supply>();
  private impresoById = new Map<string, Impreso>();
  private retailSaleById = new Map<string, RetailSale>();

  applyState(state: StoreState): void {
    this.generalSettings = state.generalSettings;
    this.brands = state.brands ?? [];
    this.supplies = state.supplies;
    this.impresos = state.impresos;
    this.categories = state.categories;
    this.products = state.products;
    this.customers = state.customers;
    this.orders = state.orders;
    this.quotes = state.quotes;
    this.printJobs = state.printJobs;
    this.retailSales = state.retailSales;
    this.treasuryExpenses = state.treasuryExpenses;
    this.calendarEntries = state.calendarEntries ?? [];
    this.invalidateIndexes();
  }

  toState(): StoreState {
    return {
      generalSettings: this.generalSettings,
      brands: this.brands,
      supplies: this.supplies,
      impresos: this.impresos,
      categories: this.categories,
      products: this.products,
      customers: this.customers,
      orders: this.orders,
      quotes: this.quotes,
      printJobs: this.printJobs,
      retailSales: this.retailSales,
      treasuryExpenses: this.treasuryExpenses,
      calendarEntries: this.calendarEntries,
    };
  }

  applySeed(): void {
    this.applyState(createSeedState());
  }

  nextId(prefix: string, items: { id: string }[]): string {
    const numbers = items
      .map((item) => parseInt(item.id.split('-')[1] ?? '0', 10))
      .filter((n) => !Number.isNaN(n));
    const next = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
    return `${prefix}-${next}`;
  }

  getCategoryById(id: string): Category | undefined {
    this.ensureCategoryIndex();
    return this.categoryById.get(id);
  }

  indexCategory(category: Category): void {
    this.ensureCategoryIndex();
    this.categoryById.set(category.id, category);
  }

  replaceCategory(category: Category): void {
    replaceInCollection(this.categories, category.id, category);
    this.indexCategory(category);
  }

  removeCategory(id: string): boolean {
    const removed = removeFromCollection(this.categories, id);
    if (removed) {
      this.categoryById.delete(id);
      this.categoryIndexLen = this.categories.length;
    }
    return removed;
  }

  getProductById(id: string): Product | undefined {
    this.ensureProductIndex();
    return this.productById.get(id);
  }

  indexProduct(product: Product): void {
    this.ensureProductIndex();
    this.productById.set(product.id, product);
  }

  replaceProduct(product: Product): void {
    replaceInCollection(this.products, product.id, product);
    this.indexProduct(product);
  }

  removeProduct(id: string): boolean {
    const removed = removeFromCollection(this.products, id);
    if (removed) {
      this.productById.delete(id);
      this.productIndexLen = this.products.length;
    }
    return removed;
  }

  getCustomerById(id: string): Customer | undefined {
    this.ensureCustomerIndex();
    return this.customerById.get(id);
  }

  indexCustomer(customer: Customer): void {
    this.ensureCustomerIndex();
    this.customerById.set(customer.id, customer);
  }

  replaceCustomer(customer: Customer): void {
    replaceInCollection(this.customers, customer.id, customer);
    this.indexCustomer(customer);
  }

  removeCustomer(id: string): boolean {
    const removed = removeFromCollection(this.customers, id);
    if (removed) {
      this.customerById.delete(id);
      this.customerIndexLen = this.customers.length;
    }
    return removed;
  }

  getOrderById(id: string): Order | undefined {
    this.ensureOrderIndex();
    return this.orderById.get(id);
  }

  indexOrder(order: Order): void {
    this.ensureOrderIndex();
    this.orderById.set(order.id, order);
  }

  replaceOrder(order: Order): void {
    replaceInCollection(this.orders, order.id, order);
    this.indexOrder(order);
  }

  removeOrder(id: string): boolean {
    const removed = removeFromCollection(this.orders, id);
    if (removed) {
      this.orderById.delete(id);
      this.orderIndexLen = this.orders.length;
    }
    return removed;
  }

  getQuoteById(id: string): Quote | undefined {
    this.ensureQuoteIndex();
    return this.quoteById.get(id);
  }

  indexQuote(quote: Quote): void {
    this.ensureQuoteIndex();
    this.quoteById.set(quote.id, quote);
  }

  replaceQuote(quote: Quote): void {
    replaceInCollection(this.quotes, quote.id, quote);
    this.indexQuote(quote);
  }

  removeQuote(id: string): boolean {
    const removed = removeFromCollection(this.quotes, id);
    if (removed) {
      this.quoteById.delete(id);
      this.quoteIndexLen = this.quotes.length;
    }
    return removed;
  }

  getPrintJobById(id: string): PrintJob | undefined {
    this.ensurePrintJobIndex();
    return this.printJobById.get(id);
  }

  getSupplyById(id: string): Supply | undefined {
    this.ensureSupplyIndex();
    return this.supplyById.get(id);
  }

  indexSupply(supply: Supply): void {
    this.ensureSupplyIndex();
    this.supplyById.set(supply.id, supply);
  }

  replaceSupply(supply: Supply): void {
    replaceInCollection(this.supplies, supply.id, supply);
    this.indexSupply(supply);
  }

  removeSupply(id: string): boolean {
    const removed = removeFromCollection(this.supplies, id);
    if (removed) {
      this.supplyById.delete(id);
      this.supplyIndexLen = this.supplies.length;
    }
    return removed;
  }

  getImpresoById(id: string): Impreso | undefined {
    this.ensureImpresoIndex();
    return this.impresoById.get(id);
  }

  getRetailSaleById(id: string): RetailSale | undefined {
    this.ensureRetailSaleIndex();
    return this.retailSaleById.get(id);
  }

  indexRetailSale(sale: RetailSale): void {
    this.ensureRetailSaleIndex();
    this.retailSaleById.set(sale.id, sale);
  }

  replaceRetailSale(sale: RetailSale): void {
    replaceInCollection(this.retailSales, sale.id, sale);
    this.indexRetailSale(sale);
  }

  removeRetailSale(id: string): boolean {
    const removed = removeFromCollection(this.retailSales, id);
    if (removed) {
      this.retailSaleById.delete(id);
      this.retailSaleIndexLen = this.retailSales.length;
    }
    return removed;
  }

  nextOrderId(): string {
    return this.nextId('ord', this.orders);
  }

  nextQuoteId(): string {
    return this.nextId('qte', this.quotes);
  }

  nextRetailSaleId(): string {
    return this.nextId('sale', this.retailSales);
  }

  nextTreasuryExpenseId(): string {
    return this.nextId('treasury', this.treasuryExpenses);
  }

  nextCalendarEntryId(): string {
    return this.nextId('cal', this.calendarEntries);
  }

  getCalendarEntryById(id: string): CalendarEntry | undefined {
    return this.calendarEntries.find((entry) => entry.id === id);
  }

  replaceCalendarEntry(entry: CalendarEntry): void {
    replaceInCollection(this.calendarEntries, entry.id, entry);
  }

  removeCalendarEntry(id: string): boolean {
    return removeFromCollection(this.calendarEntries, id);
  }

  private invalidateIndexes(): void {
    this.categoryIndexLen = -1;
    this.productIndexLen = -1;
    this.customerIndexLen = -1;
    this.orderIndexLen = -1;
    this.quoteIndexLen = -1;
    this.printJobIndexLen = -1;
    this.supplyIndexLen = -1;
    this.impresoIndexLen = -1;
    this.retailSaleIndexLen = -1;
  }

  private ensureCategoryIndex(): void {
    if (this.categoryIndexLen === this.categories.length) return;
    this.categoryById = new Map(this.categories.map((item) => [item.id, item]));
    this.categoryIndexLen = this.categories.length;
  }

  private ensureProductIndex(): void {
    if (this.productIndexLen === this.products.length) return;
    this.productById = new Map(this.products.map((item) => [item.id, item]));
    this.productIndexLen = this.products.length;
  }

  private ensureCustomerIndex(): void {
    if (this.customerIndexLen === this.customers.length) return;
    this.customerById = new Map(this.customers.map((item) => [item.id, item]));
    this.customerIndexLen = this.customers.length;
  }

  private ensureOrderIndex(): void {
    if (this.orderIndexLen === this.orders.length) return;
    this.orderById = new Map(this.orders.map((item) => [item.id, item]));
    this.orderIndexLen = this.orders.length;
  }

  private ensureQuoteIndex(): void {
    if (this.quoteIndexLen === this.quotes.length) return;
    this.quoteById = new Map(this.quotes.map((item) => [item.id, item]));
    this.quoteIndexLen = this.quotes.length;
  }

  private ensurePrintJobIndex(): void {
    if (this.printJobIndexLen === this.printJobs.length) return;
    this.printJobById = new Map(this.printJobs.map((item) => [item.id, item]));
    this.printJobIndexLen = this.printJobs.length;
  }

  private ensureSupplyIndex(): void {
    if (this.supplyIndexLen === this.supplies.length) return;
    this.supplyById = new Map(this.supplies.map((item) => [item.id, item]));
    this.supplyIndexLen = this.supplies.length;
  }

  private ensureImpresoIndex(): void {
    if (this.impresoIndexLen === this.impresos.length) return;
    this.impresoById = new Map(this.impresos.map((item) => [item.id, item]));
    this.impresoIndexLen = this.impresos.length;
  }

  private ensureRetailSaleIndex(): void {
    if (this.retailSaleIndexLen === this.retailSales.length) return;
    this.retailSaleById = new Map(
      this.retailSales.map((item) => [item.id, item]),
    );
    this.retailSaleIndexLen = this.retailSales.length;
  }
}
