import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AgentApproval as DbAgentApproval } from '@prisma/client';
import { randomUUID } from 'crypto';
import { AlertsNotifier } from '../alerts/alerts-notifier';
import { ApiKeyPrincipal } from '../api-keys/api-key-scopes';
import { PaymentMethod } from '../common/enums';
import { OrdersService } from '../orders/orders.service';
import { fromJson, toInputJson } from '../prisma/json.util';
import { PrismaService } from '../prisma/prisma.service';
import { QuotesService } from '../quotes/quotes.service';
import { StoreChangeService } from '../store/store-change.service';

export type AgentApprovalKind = 'quote' | 'payment';
export const AGENT_APPROVAL_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'failed',
] as const;
export type AgentApprovalStatus = (typeof AGENT_APPROVAL_STATUSES)[number];

export interface PaymentApprovalPayload {
  orderId: string;
  amount: number;
  method?: PaymentMethod;
  deposit?: boolean;
}

export interface AgentApprovalView {
  id: string;
  kind: AgentApprovalKind;
  status: AgentApprovalStatus;
  summary: string;
  referenceId: string | null;
  apiKeyName: string;
  error: string | null;
  decidedAt: string | null;
  createdAt: string;
}

function toView(row: DbAgentApproval): AgentApprovalView {
  return {
    id: row.id,
    kind: row.kind as AgentApprovalKind,
    status: row.status as AgentApprovalStatus,
    summary: row.summary,
    referenceId: row.referenceId,
    apiKeyName: row.apiKeyName,
    error: row.error,
    decidedAt: row.decidedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Acciones de agentes que esperan la aprobación de Isaías (§28.4). */
@Injectable()
export class AgentApprovalsService {
  private readonly logger = new Logger(AgentApprovalsService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly orders: OrdersService,
    private readonly quotes: QuotesService,
    private readonly storeChange: StoreChangeService,
    private readonly notifier: AlertsNotifier,
  ) {}

  private db() {
    if (!this.prismaService.isConfigured()) {
      throw new ServiceUnavailableException(
        'Las aprobaciones requieren DATABASE_URL configurada',
      );
    }
    return this.prismaService.prisma;
  }

  async create(input: {
    kind: AgentApprovalKind;
    payload: unknown;
    summary: string;
    referenceId?: string;
    apiKey: ApiKeyPrincipal;
  }): Promise<AgentApprovalView> {
    const row = await this.db().agentApproval.create({
      data: {
        id: `apr-${randomUUID()}`,
        kind: input.kind,
        payload: toInputJson(input.payload),
        summary: input.summary.slice(0, 255),
        referenceId: input.referenceId ?? null,
        apiKeyId: input.apiKey.id,
        apiKeyName: input.apiKey.name,
        createdAt: new Date(),
      },
    });
    // Aviso al instante; si falla, la aprobación queda igual en Ajustes.
    this.notifier
      .notifyOwnerWhatsApp(
        `Odell: ${input.apiKey.name} pide tu aprobación. ${row.summary}`,
      )
      .catch((error: unknown) => {
        this.logger.warn(
          `No se pudo avisar la aprobación ${row.id}: ${String(error)}`,
        );
      });
    return toView(row);
  }

  async list(status?: string): Promise<AgentApprovalView[]> {
    const where = AGENT_APPROVAL_STATUSES.includes(
      status as AgentApprovalStatus,
    )
      ? { status }
      : {};
    const rows = await this.db().agentApproval.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toView);
  }

  async approve(id: string, actorId?: string): Promise<AgentApprovalView> {
    const row = await this.decide(id, 'approved', actorId);
    // Presupuesto: el borrador queda tal cual en Presupuestos.
    if (row.kind !== 'payment') return toView(row);

    const payload = fromJson<PaymentApprovalPayload>(row.payload);
    try {
      this.orders.addPayment(payload.orderId, payload);
      this.storeChange.recordChange({
        collections: ['orders'],
        realtime: {
          scopes: ['orders', 'dashboard', 'sales'],
          action: 'update',
          entity: 'order',
          id: payload.orderId,
        },
      });
      return toView(row);
    } catch (error) {
      return this.markFailed(id, error);
    }
  }

  async reject(id: string, actorId?: string): Promise<AgentApprovalView> {
    const row = await this.decide(id, 'rejected', actorId);
    // Pago: no se toca nada. Presupuesto: se borra el borrador.
    if (row.kind !== 'quote' || !row.referenceId) return toView(row);

    try {
      this.quotes.remove(row.referenceId);
      this.storeChange.recordChange({
        collections: ['quotes'],
        realtime: {
          scopes: ['dashboard', 'quotes'],
          action: 'delete',
          entity: 'quote',
          id: row.referenceId,
        },
      });
    } catch (error) {
      // Ya borrado a mano: no hay nada que deshacer.
      if (!(error instanceof NotFoundException)) {
        return this.markFailed(id, error);
      }
    }
    return toView(row);
  }

  /** Solo decide una vez: la segunda aprobación o rechazo da 409. */
  private async decide(
    id: string,
    status: AgentApprovalStatus,
    actorId?: string,
  ): Promise<DbAgentApproval> {
    const { count } = await this.db().agentApproval.updateMany({
      where: { id, status: 'pending' },
      data: {
        status,
        decidedByUserId: actorId ?? null,
        decidedAt: new Date(),
      },
    });
    if (count === 0) {
      const exists = await this.db().agentApproval.findUnique({
        where: { id },
      });
      if (!exists)
        throw new NotFoundException(`Aprobación ${id} no encontrada`);
      throw new ConflictException('Esta aprobación ya fue resuelta');
    }
    return this.db().agentApproval.findUniqueOrThrow({ where: { id } });
  }

  private async markFailed(
    id: string,
    error: unknown,
  ): Promise<AgentApprovalView> {
    const row = await this.db().agentApproval.update({
      where: { id },
      data: {
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      },
    });
    return toView(row);
  }
}
