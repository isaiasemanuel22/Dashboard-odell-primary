import { OrderStatus } from '../common/enums';
import { AutomaticAlertsSettings } from '../common/interfaces';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { StoreService } from '../store/store.service';
import {
  ReorderRow,
  SuppliesReorderService,
} from '../supplies/supplies-reorder.service';
import { AlertsNotifier } from './alerts-notifier';
import { AlertsService } from './alerts.service';

describe('AlertsService', () => {
  const now = new Date('2026-11-18T12:00:00.000Z');
  let alerts: AutomaticAlertsSettings;
  let rows: ReorderRow[];
  let notifier: {
    notifyOwnerWhatsApp: jest.Mock;
    notifyOwnerEmail: jest.Mock;
  };
  let service: AlertsService;

  beforeEach(() => {
    alerts = { ordersDue: true, lowStock: true, weeklyReceivables: true };
    rows = [
      {
        supplyId: 'sup-1',
        name: 'PLA negro',
        unit: 'g',
        stock: 0,
        weeklyConsumption: 0,
        coversDays: null,
        supplier: null,
        orderBy: '2026-11-18',
        status: 'urgent',
        reason: 'out_of_stock',
        suggestedQuantity: 1000,
        insufficientData: true,
      },
    ];
    notifier = {
      notifyOwnerWhatsApp: jest.fn().mockResolvedValue(undefined),
      notifyOwnerEmail: jest.fn().mockResolvedValue(undefined),
    };
    const store = {
      orders: [
        {
          id: 'ord-1',
          customerName: 'Ana',
          status: OrderStatus.PENDIENTE,
          dueDate: '2026-11-10',
          total: 1000,
        },
      ],
      getCustomerById: () => undefined,
    };
    service = new AlertsService(
      store as unknown as StoreService,
      { getAutomaticAlerts: () => alerts } as unknown as SettingsService,
      { computeRows: () => rows } as unknown as SuppliesReorderService,
      { isConfigured: () => false } as unknown as PrismaService,
      notifier as unknown as AlertsNotifier,
    );
  });

  it('con la casilla apagada no manda nada', async () => {
    alerts = { ordersDue: false, lowStock: false, weeklyReceivables: false };
    await service.runOrdersDue(now);
    await service.runLowStock(now);
    await service.runWeeklyReceivables(now);
    expect(notifier.notifyOwnerWhatsApp).not.toHaveBeenCalled();
    expect(notifier.notifyOwnerEmail).not.toHaveBeenCalled();
  });

  it('no repite el aviso de pedidos del mismo día', async () => {
    await service.runOrdersDue(now);
    await service.runOrdersDue(now);
    expect(notifier.notifyOwnerWhatsApp).toHaveBeenCalledTimes(1);
  });

  it('avisa una vez por insumo y vuelve a avisar después de reponerse', async () => {
    await service.runLowStock(now);
    await service.runLowStock(now);
    expect(notifier.notifyOwnerWhatsApp).toHaveBeenCalledTimes(1);

    const pending = rows;
    rows = [];
    await service.runLowStock(now);
    rows = pending;
    await service.runLowStock(now);
    expect(notifier.notifyOwnerWhatsApp).toHaveBeenCalledTimes(2);
  });
});
