import {
  Brand,
  CalendarEntry,
  Category,
  ChatConversation,
  ChatMessage,
  Customer,
  Fair,
  GeneralSettings,
  Impreso,
  Order,
  PrintJob,
  Product,
  Quote,
  RetailSale,
  Spool,
  Supplier,
  Supply,
  SupplyMovement,
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
  fairs: Fair[];
  suppliers: Supplier[];
  spools: Spool[];
  supplyMovements: SupplyMovement[];
  chatConversations: ChatConversation[];
  chatMessages: ChatMessage[];
}

export type StoreCollectionKey = keyof Omit<StoreState, 'generalSettings'>;
