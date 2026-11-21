import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { arTodayKey } from '../common/utils/ar-date.util';
import { computeReceivables } from '../dashboard/receivables.util';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { StoreService } from '../store/store.service';
import { SuppliesReorderService } from '../supplies/supplies-reorder.service';
import { AlertsNotifier } from './alerts-notifier';
import {
  buildOrdersDueDigest,
  buildReceivablesEmail,
  buildStockAlertText,
  stockAlertRows,
} from './alerts.util';

type AlertKind = 'orders-due' | 'receivables' | 'stock';
type AlertChannel = 'whatsapp' | 'email';

/** Avisos automáticos a Isaías (§28.5), sin repetir lo ya avisado. */
@Injectable()
export class AlertsService {
  /** Sin base (local): el registro de avisos vive en memoria. */
  private readonly memoryLog = new Map<string, AlertKind>();

  constructor(
    private readonly store: StoreService,
    private readonly settings: SettingsService,
    private readonly reorder: SuppliesReorderService,
    private readonly prismaService: PrismaService,
    private readonly notifier: AlertsNotifier,
  ) {}

  /** Pedidos atrasados o que vencen mañana, una vez por día. */
  async runOrdersDue(now = new Date()): Promise<void> {
    if (!this.settings.getAutomaticAlerts().ordersDue) return;
    const key = `orders-due:${arTodayKey(now)}`;
    if (await this.hasLog(key)) return;
    const { text } = buildOrdersDueDigest(this.store.orders, now);
    if (!text) return;
    await this.notifier.notifyOwnerWhatsApp(text);
    await this.saveLog('orders-due', key, 'whatsapp', now);
  }

  /** Resumen de saldos por cobrar por email, una vez por día (los lunes). */
  async runWeeklyReceivables(now = new Date()): Promise<void> {
    if (!this.settings.getAutomaticAlerts().weeklyReceivables) return;
    const key = `receivables:${arTodayKey(now)}`;
    if (await this.hasLog(key)) return;
    const receivables = computeReceivables(this.store);
    if (!receivables.rows.length) return;
    const email = buildReceivablesEmail(receivables);
    await this.notifier.notifyOwnerEmail(email.subject, email.html, email.text);
    await this.saveLog('receivables', key, 'email', now);
  }

  /**
   * Stock bajo y «pedir antes del»: avisa una vez por insumo y motivo. Cuando
   * el insumo sale de la lista (se repuso) se borra su registro para que
   * vuelva a avisar.
   */
  async runLowStock(now = new Date()): Promise<void> {
    if (!this.settings.getAutomaticAlerts().lowStock) return;
    const rows = stockAlertRows(this.reorder.computeRows(now), arTodayKey(now));
    const keyOf = (row: (typeof rows)[number]) =>
      `stock:${row.supplyId}:${row.reason}`;
    const activeKeys = new Set(rows.map(keyOf));
    const loggedKeys = await this.listKeys('stock');

    const stale = loggedKeys.filter((key) => !activeKeys.has(key));
    if (stale.length) await this.deleteKeys(stale);

    const logged = new Set(loggedKeys);
    const fresh = rows.filter((row) => !logged.has(keyOf(row)));
    if (!fresh.length) return;
    await this.notifier.notifyOwnerWhatsApp(buildStockAlertText(fresh));
    for (const row of fresh) {
      await this.saveLog('stock', keyOf(row), 'whatsapp', now);
    }
  }

  private async hasLog(key: string): Promise<boolean> {
    if (!this.prismaService.isConfigured()) return this.memoryLog.has(key);
    const row = await this.prismaService.prisma.notificationLog.findUnique({
      where: { dedupeKey: key },
    });
    return !!row;
  }

  private async listKeys(kind: AlertKind): Promise<string[]> {
    if (!this.prismaService.isConfigured()) {
      return [...this.memoryLog]
        .filter(([, value]) => value === kind)
        .map(([key]) => key);
    }
    const rows = await this.prismaService.prisma.notificationLog.findMany({
      where: { kind },
      select: { dedupeKey: true },
    });
    return rows.map((row) => row.dedupeKey);
  }

  private async deleteKeys(keys: string[]): Promise<void> {
    if (!this.prismaService.isConfigured()) {
      keys.forEach((key) => this.memoryLog.delete(key));
      return;
    }
    await this.prismaService.prisma.notificationLog.deleteMany({
      where: { dedupeKey: { in: keys } },
    });
  }

  private async saveLog(
    kind: AlertKind,
    key: string,
    channel: AlertChannel,
    sentAt: Date,
  ): Promise<void> {
    if (!this.prismaService.isConfigured()) {
      this.memoryLog.set(key, kind);
      return;
    }
    await this.prismaService.prisma.notificationLog.create({
      data: { id: randomUUID(), kind, dedupeKey: key, channel, sentAt },
    });
  }
}
