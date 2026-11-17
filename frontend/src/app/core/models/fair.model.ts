import type { PaymentMethod, TreasuryAccount } from './index';

export type FairStatus = 'planned' | 'open' | 'closed';

export interface Fair {
  id: string;
  name: string;
  /** YYYY-MM-DD */
  date: string;
  recurring: boolean;
  calendarEntryId: string | null;
  status: FairStatus;
  openedAt: string | null;
  openingFloat: number;
  closedAt: string | null;
  countedCash: number | null;
  cashDifference: number | null;
  differenceReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FairSummary extends Fair {
  salesCount: number;
  sold: number;
  cost: number;
  expenses: number;
  result: number;
}

export interface FairKpis {
  sold: number;
  net: number;
  fairsCount: number;
  bestFair: { id: string; name: string; date: string; result: number } | null;
  topProduct: { productId: string; name: string; quantity: number } | null;
}

export interface FairsOverview {
  fairs: FairSummary[];
  kpis: FairKpis;
}

export interface FairByMethod {
  efectivo: number;
  mercado_pago: number;
  transferencia: number;
}

export interface FairExpenseEntry {
  id: string;
  name: string;
  amount: number;
  account: TreasuryAccount | string;
  occurredAt: string;
}

export interface FairSaleItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface FairSaleEntry {
  id: string;
  soldAt: string;
  total: number;
  method: PaymentMethod | string;
  items: FairSaleItem[];
}

export interface FairDetail extends FairSummary {
  byMethod: FairByMethod;
  expectedCash: number;
  bestHour: { from: number; to: number; count: number } | null;
  expensesList: FairExpenseEntry[];
  sales: FairSaleEntry[];
}

export interface CreateFairPayload {
  name: string;
  date: string;
  recurring?: boolean;
  calendarEntryId?: string | null;
  openingFloat?: number;
}

export type UpdateFairPayload = Partial<CreateFairPayload>;

export interface CreateFairExpensePayload {
  name: string;
  amount: number;
  account?: TreasuryAccount;
}

export interface CloseFairPayload {
  countedCash: number;
  differenceReason?: string;
}

export interface FairPlanItem {
  productId: string;
  name: string;
  average: number;
  stock: number;
  take: number;
  toPrint: number;
}

export interface FairPlan {
  basedOn: number;
  items: FairPlanItem[];
}
