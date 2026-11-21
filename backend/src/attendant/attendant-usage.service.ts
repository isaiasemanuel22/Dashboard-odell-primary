import { Injectable } from '@nestjs/common';
import { AgentRun as DbAgentRun } from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  getMonthRange,
  isDateInMonthRange,
} from '../common/utils/month-range.util';
import { fromJson, toInputJson } from '../prisma/json.util';
import { PrismaService } from '../prisma/prisma.service';
import { AttendantUsage } from './attendant-pricing';

export type AgentRunOutcome =
  'replied' | 'handed_off' | 'suggested' | 'skipped' | 'error';

/** Qué hizo el agente en una herramienta, armado por código. */
export interface AgentToolSummary {
  tool: string;
  label: string;
  detail: string;
}

export interface AgentRun extends AttendantUsage {
  id: string;
  conversationId: string;
  triggerMessageId: string;
  outcome: AgentRunOutcome;
  toolSummary: AgentToolSummary[];
  replyMessageIds: string[];
  model: string;
  costUsd: number;
  error: string | null;
  createdAt: string;
}

function toRun(row: DbAgentRun): AgentRun {
  return {
    ...row,
    outcome: row.outcome as AgentRunOutcome,
    toolSummary: fromJson<AgentToolSummary[]>(row.toolSummary),
    replyMessageIds: fromJson<string[]>(row.replyMessageIds),
    createdAt: row.createdAt.toISOString(),
  };
}

/** Corridas del agente de atención y su gasto (§28.3). */
@Injectable()
export class AttendantUsageService {
  /** Sin base (local): las corridas viven en memoria. */
  private readonly memoryRuns: AgentRun[] = [];

  constructor(private readonly prismaService: PrismaService) {}

  async save(
    data: Omit<AgentRun, 'id' | 'createdAt'>,
    now = new Date(),
  ): Promise<AgentRun> {
    const run: AgentRun = {
      ...data,
      id: randomUUID(),
      createdAt: now.toISOString(),
    };
    if (!this.prismaService.isConfigured()) {
      this.memoryRuns.push(run);
      return run;
    }
    await this.prismaService.prisma.agentRun.create({
      data: {
        ...run,
        toolSummary: toInputJson(run.toolSummary),
        replyMessageIds: toInputJson(run.replyMessageIds),
        createdAt: now,
      },
    });
    return run;
  }

  /** Tokens y gasto del mes calendario (hora AR). */
  async monthUsage(
    now = new Date(),
  ): Promise<AttendantUsage & { costUsd: number }> {
    const range = getMonthRange(now);
    if (!this.prismaService.isConfigured()) {
      const runs = this.memoryRuns.filter((run) =>
        isDateInMonthRange(new Date(run.createdAt), range),
      );
      const sum = (key: keyof AttendantUsage | 'costUsd') =>
        runs.reduce((total, run) => total + run[key], 0);
      return {
        inputTokens: sum('inputTokens'),
        outputTokens: sum('outputTokens'),
        cacheReadTokens: sum('cacheReadTokens'),
        cacheWriteTokens: sum('cacheWriteTokens'),
        costUsd: sum('costUsd'),
      };
    }
    const { _sum } = await this.prismaService.prisma.agentRun.aggregate({
      where: { createdAt: { gte: range.start, lte: range.end } },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        cacheReadTokens: true,
        cacheWriteTokens: true,
        costUsd: true,
      },
    });
    return {
      inputTokens: _sum.inputTokens ?? 0,
      outputTokens: _sum.outputTokens ?? 0,
      cacheReadTokens: _sum.cacheReadTokens ?? 0,
      cacheWriteTokens: _sum.cacheWriteTokens ?? 0,
      costUsd: _sum.costUsd ?? 0,
    };
  }

  async monthSpentUsd(now = new Date()): Promise<number> {
    return (await this.monthUsage(now)).costUsd;
  }

  /** Últimas corridas de un chat, de la más nueva a la más vieja. */
  async recentRuns(conversationId: string, limit = 5): Promise<AgentRun[]> {
    if (!this.prismaService.isConfigured()) {
      return this.memoryRuns
        .filter((run) => run.conversationId === conversationId)
        .reverse()
        .slice(0, limit);
    }
    const rows = await this.prismaService.prisma.agentRun.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map(toRun);
  }
}
