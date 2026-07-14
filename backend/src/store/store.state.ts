import {
  Category,
  Customer,
  GeneralSettings,
  Impreso,
  Material,
  Order,
  PrintJob,
  Product,
  RetailSale,
  Supply,
} from '../common/interfaces';

export interface StoreState {
  generalSettings: GeneralSettings;
  supplies: Supply[];
  impresos: Impreso[];
  categories: Category[];
  products: Product[];
  customers: Customer[];
  orders: Order[];
  printJobs: PrintJob[];
  retailSales: RetailSale[];
  materials: Material[];
}

export type StoreCollectionKey = keyof Omit<StoreState, 'generalSettings'>;
