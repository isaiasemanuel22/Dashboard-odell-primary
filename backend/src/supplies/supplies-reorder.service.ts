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
export type ReorderReason = 'forecast' | 'out_of_stock' | 'below_min';

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
  reason: ReorderReason | null;
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
      const minRaw = supply.minStock;
      const minStock =
        minRaw != null && Number.isFinite(Number(minRaw))
          ? Number(minRaw)
          : null;
      const hasMin = minStock != null;
      const outOfStock = stock <= 0;
      const belowMin = !outOfStock && hasMin && stock <= (minStock as number);
      const hasConsumption = consumptionMoves.length > 0;

      // Sin consumo y por encima del mínimo: no listar en reposición.
      if (!hasConsumption && !outOfStock && !belowMin) {
        continue;
      }

      const firstAt = consumptionMoves[0]?.at;
      const firstAgeDays = firstAt
        ? (now.getTime() - new Date(firstAt).getTime()) / (24 * 60 * 60 * 1000)
        : 0;
      const insufficientData =
        !hasConsumption ||
        inWindow.length === 0 ||
        !firstAt ||
        firstAgeDays < 7;

      const coversDays =
        hasConsumption && daily > 1e-12 ? stock / daily : null;

      const supplierEntity = supply.supplierId
        ? (this.store.getSupplierById(supply.supplierId) ?? null)
        : null;
      const supplier = supplierEntity
        ? {
            id: supplierEntity.id,
            name: supplierEntity.name,
            leadTimeBusinessDays: supplierEntity.leadTimeBusinessDays,
          }
        : null;
      const lead = supplier?.leadTimeBusinessDays ?? null;

      let reason: ReorderReason | null = null;
      let status: ReorderStatus = 'ok';
      let orderBy: string | null = null;
      let suggested = 0;

      if (outOfStock || belowMin) {
        reason = outOfStock ? 'out_of_stock' : 'below_min';
        status = 'urgent';
        orderBy = today;
        if (!hasConsumption) {
          suggested = this.suggestedWithoutConsumption(supply, stock, minStock);
        } else if (daily > 1e-12 && lead != null) {
          suggested = this.suggestedFromForecast(supply, stock, daily, today, lead);
          if (suggested <= 0) {
            suggested = this.suggestedWithoutConsumption(
              supply,
              stock,
              minStock,
            );
          }
        } else {
          suggested = this.suggestedWithoutConsumption(supply, stock, minStock);
        }
      } else if (hasConsumption) {
        reason = 'forecast';
        orderBy =
          lead != null ? computeOrderByDate(today, coversDays, lead) : null;
        if (orderBy) {
          const urgentBy = addCalendarDaysToKey(today, 7);
          if (orderBy <= urgentBy) status = 'urgent';
          else if (calendarDaysBetween(today, orderBy) <= 30) status = 'soon';
        } else if (coversDays != null && coversDays <= 7) {
          status = 'urgent';
        }
        if (daily > 1e-12 && lead != null) {
          suggested = this.suggestedFromForecast(
            supply,
            stock,
            daily,
            today,
            lead,
          );
        }
      } else {
        // Sin consumo y stock OK: no debería llegar (continue arriba).
        reason = null;
        status = 'ok';
        orderBy = null;
        suggested = 0;
      }

      rows.push({
        supplyId: supply.id,
        name: supply.name,
        unit: supply.unit,
        stock,
        weeklyConsumption,
        coversDays,
        supplier,
        orderBy,
        status,
        reason,
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

  private suggestedFromForecast(
    supply: {
      category: SupplyCategory;
      unit: string;
      spoolGrams?: number | null;
    },
    stock: number,
    daily: number,
    today: string,
    lead: number,
  ): number {
    const leadCalendar = businessDaysToCalendarDays(today, lead);
    const cushionDays = leadCalendar + 14;
    const need = daily * cushionDays - stock;
    if (need <= 1e-9) return 0;
    return this.roundSuggested(supply, need);
  }

  private suggestedWithoutConsumption(
    supply: {
      category: SupplyCategory;
      unit: string;
      spoolGrams?: number | null;
    },
    stock: number,
    minStock: number | null,
  ): number {
    if (minStock != null) {
      const need = Math.max(minStock - stock, 0);
      if (need <= 1e-9) {
        return supply.category === SupplyCategory.FDM
          ? this.roundSuggested(supply, gramsToSupplyQuantity(supply, resolveSpoolGrams(supply)))
          : 1;
      }
      return this.roundSuggested(supply, need);
    }
    // Sin mínimo: 1 bobina / 1 unidad.
    if (supply.category === SupplyCategory.FDM) {
      return this.roundSuggested(
        supply,
        gramsToSupplyQuantity(supply, resolveSpoolGrams(supply)),
      );
    }
    return 1;
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
      const multiples = Math.max(1, Math.ceil(needGrams / spoolGrams - 1e-9));
      const grams = multiples * spoolGrams;
      return gramsToSupplyQuantity(
        { unit: supply.unit, category: SupplyCategory.FDM },
        grams,
      );
    }
    return Math.max(1, Math.ceil(need - 1e-9));
  }
}
