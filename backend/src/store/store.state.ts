import {
  Category,
  Customer,
  GeneralSettings,
  Impreso,
  Material,
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
  supplies: Supply[];
  impresos: Impreso[];
  categories: Category[];
  products: Product[];
  customers: Customer[];
  orders: Order[];
  quotes: Quote[];
  printJobs: PrintJob[];
  retailSales: RetailSale[];
  materials: Material[];
  treasuryExpenses: TreasuryExpense[];
}

export type StoreCollectionKey = keyof Omit<StoreState, 'generalSettings'>;
