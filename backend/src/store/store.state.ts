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

export interface StoreState {
  generalSettings: GeneralSettings;
  brands: Brand[];
  supplies: Supply[];
  impresos: Impreso[];
  categories: Category[];
  products: Product[];
  customers: Customer[];
  orders: Order[];
  quotes: Quote[];
  printJobs: PrintJob[];
  retailSales: RetailSale[];
  treasuryExpenses: TreasuryExpense[];
  calendarEntries: CalendarEntry[];
}

export type StoreCollectionKey = keyof Omit<StoreState, 'generalSettings'>;
