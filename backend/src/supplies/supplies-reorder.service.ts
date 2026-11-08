import { Injectable } from '@nestjs/common';
import { SupplyCategory } from '../common/enums';
import { StoreService } from '../store/store.service';
import {
  addCalendarDaysToKey,
  arTodayKey,
  businessDaysToCalendarDays,
  calendarDaysBetween,
  computeOrderByDate,
} from './business-days.util';
import {
  gramsToSupplyQuantity,
  resolveSpoolGrams,
  supplyQuantityToGrams,
} from './supply-units.util';

export type ReorderStatus = 'urgent' | 'soon' | 'ok';

export interface ReorderRow {
  supplyId: string;
  name: string;
  unit: string;
  stock: number;
  weeklyConsumption: number;
  coversDays: number | null;
  supplier: {
    id: string;
    name: string;
    leadTimeBusinessDays: number;
  } | null;
  orderBy: string | null;
  status: ReorderStatus;
  suggestedQuantity: number;
  insufficientData: boolean;
}

export interface ReorderSummary {
  rows: ReorderRow[];
  openSpools: number;
  urgentCount: number;
}

@Injectable()
export class SuppliesReorderService {
  constructor(private readonly store: StoreService) {}

  getReorder(now = new Date()): ReorderSummary {
    const rows = this.computeRows(now);
    const openSpools = this.store.spools.filter((s) => !s.finishedAt).length;
    const urgentCount = rows.filter((r) => r.status === 'urgent').length;
    return { rows, openSpools, urgentCount };
  }

  computeRows(now = new Date()): ReorderRow[] {
    const today = arTodayKey(now);
    const windowStart = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
    const rows: ReorderRow[] = [];

    for (const supply of this.store.supplies) {
      const consumptionMoves = this.store.supplyMovements
        .filter(
          (m) =>
            m.supplyId === supply.id &&
            (m.reason === 'task' || m.reason === 'failure') &&
            m.delta < 0,
        )
        .sort((a, b) => a.at.localeCompare(b.at));

      const inWindow = consumptionMoves.filter(
        (m) => new Date(m.at).getTime() >= windowStart.getTime(),
      );

      const consumedInWindow = inWindow.reduce(
        (sum, m) => sum + Math.abs(Number(m.delta) || 0),
        0,
      );
      const weeklyConsumption = (consumedInWindow * 7) / 28;
      const daily = weeklyConsumption / 7;
      const stock = Number(supply.quantity) || 0;
      const lowStock = stock <= Number(supply.minStock);
      const hasConsumption = consumptionMoves.length > 0;

      if (!hasConsumption && !lowStock && weeklyConsumption <= 0) {
        continue;
      }

      const firstAt = consumptionMoves[0]?.at;
      const firstAgeDays = firstAt
        ? (now.getTime() - new Date(firstAt).getTime()) / (24 * 60 * 60 * 1000)
        : 0;
      const insufficientData =
        inWindow.length === 0 || !firstAt || firstAgeDays < 7;

      const coversDays = daily > 1e-12 ? stock / daily : null;

      const supplier = supply.supplierId
        ? (this.store.getSupplierById(supply.supplierId) ?? null)
        : null;
      const lead = supplier?.leadTimeBusinessDays ?? 3;
      const orderBy = computeOrderByDate(today, coversDays, lead);

      let status: ReorderStatus = 'ok';
      if (orderBy) {
        const urgentBy = addCalendarDaysToKey(today, 7);
        if (orderBy <= urgentBy) status = 'urgent';
        else if (calendarDaysBetween(today, orderBy) <= 30) status = 'soon';
      } else if (lowStock || (coversDays != null && coversDays <= 7)) {
        status = 'urgent';
      }

      const leadCalendar = businessDaysToCalendarDays(today, lead);
      const cushionDays = leadCalendar + 14;
      let suggested = 0;
      if (daily > 1e-12) {
        const need = daily * cushionDays - stock;
        if (need > 1e-9) {
          suggested = this.roundSuggested(supply, need);
        }
      }

      rows.push({
        supplyId: supply.id,
        name: supply.name,
        unit: supply.unit,
        stock,
        weeklyConsumption,
        coversDays,
        supplier: supplier
          ? {
              id: supplier.id,
              name: supplier.name,
              leadTimeBusinessDays: supplier.leadTimeBusinessDays,
            }
          : null,
        orderBy,
        status,
        suggestedQuantity: suggested,
        insufficientData,
      });
    }

    const rank = (s: ReorderStatus) =>
      s === 'urgent' ? 0 : s === 'soon' ? 1 : 2;
    return rows.sort((a, b) => {
      const rd = rank(a.status) - rank(b.status);
      if (rd !== 0) return rd;
      if (a.orderBy && b.orderBy) return a.orderBy.localeCompare(b.orderBy);
      if (a.orderBy) return -1;
      if (b.orderBy) return 1;
      return a.name.localeCompare(b.name, 'es');
    });
  }

  private roundSuggested(
    supply: {
      category: SupplyCategory;
      unit: string;
      spoolGrams?: number | null;
    },
    need: number,
  ): number {
    if (supply.category === SupplyCategory.FDM) {
      const spoolGrams = resolveSpoolGrams({
        category: SupplyCategory.FDM,
        spoolGrams: supply.spoolGrams,
      });
      const needGrams = supplyQuantityToGrams({
        quantity: need,
        unit: supply.unit,
        category: SupplyCategory.FDM,
      });
      const multiples = Math.ceil(needGrams / spoolGrams - 1e-9);
      const grams = Math.max(spoolGrams, multiples * spoolGrams);
      return gramsToSupplyQuantity(
        { unit: supply.unit, category: SupplyCategory.FDM },
        grams,
      );
    }
    return Math.ceil(need - 1e-9);
  }
}
