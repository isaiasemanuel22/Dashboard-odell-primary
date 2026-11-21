import type Anthropic from '@anthropic-ai/sdk';
import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Subscription } from 'rxjs';
import { AlertsNotifier } from '../alerts/alerts-notifier';
import { ChatsService } from '../chats/chats.service';
import { onlyDigits } from '../chats/chats.util';
import { ChatChannel, ChatDirection, ChatMessageStatus } from '../common/enums';
import { AttendantSettings, ChatMessage } from '../common/interfaces';
import { arTodayKey } from '../common/utils/ar-date.util';
import { AppConfigService } from '../config/app-config.service';
import { MetaInboundEvents } from '../meta/meta-inbound.events';
import { SettingsService } from '../settings/settings.service';
import { ChatRepository, CustomerRepository } from '../store/repositories';
import { AttendantUsage, costUsd } from './attendant-pricing';
import { ATTENDANT_SYSTEM_PROMPT, attendantContext } from './attendant-prompt';
import {
  ATTENDANT_TOOLS,
  AttendantTools,
  CHANNEL_LABELS,
  FINAL_TOOLS,
  toolLabel,
} from './attendant-tools';
import {
  AgentRunOutcome,
  AgentToolSummary,
  AttendantUsageService,
} from './attendant-usage.service';

export const ANTHROPIC_CLIENT = Symbol('ANTHROPIC_CLIENT');
/** Lo único del SDK que usa el agente; en los tests se reemplaza. */
export type AnthropicClient = Pick<Anthropic, 'messages'>;

const MAX_TURNS = 6;
const MAX_TOKENS = 1024;
const HISTORY_LIMIT = 20;
const REQUEST_TIMEOUT_MS = 45_000;
const SEEN_MESSAGES_LIMIT = 500;

interface QueueEntry {
  dirty: boolean;
  done: Promise<void>;
}

/** Agente de atención de Chats con la API de Claude (§28.3). */
@Injectable()
export class AttendantService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AttendantService.name);
  private readonly queue = new Map<string, QueueEntry>();
  private readonly seen = new Set<string>();
  /** Último mensaje del cliente que ya procesó una corrida, por chat. */
  private readonly processedUntil = new Map<string, string>();
  private subscription?: Subscription;

  constructor(
    @Inject(ANTHROPIC_CLIENT) private readonly client: AnthropicClient | null,
    private readonly inbound: MetaInboundEvents,
    private readonly tools: AttendantTools,
    private readonly usage: AttendantUsageService,
    private readonly settings: SettingsService,
    private readonly chats: ChatsService,
    private readonly chatRepository: ChatRepository,
    private readonly customers: CustomerRepository,
    private readonly notifier: AlertsNotifier,
    private readonly config: AppConfigService,
  ) {}

  onModuleInit(): void {
    if (this.config.nodeEnv === 'test') return;
    this.subscription = this.inbound.inbound$.subscribe((event) => {
      void this.enqueue(event.conversationId, event.messageId);
    });
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
  }

  /**
   * Una corrida por chat a la vez. Si entra otro mensaje mientras corre, al
   * terminar corre una sola vez más con todo lo nuevo.
   */
  enqueue(conversationId: string, messageId: string): Promise<void> {
    if (this.seen.has(messageId)) return Promise.resolve();
    this.seen.add(messageId);
    if (this.seen.size > SEEN_MESSAGES_LIMIT) {
      const [oldest] = this.seen;
      this.seen.delete(oldest);
    }

    const running = this.queue.get(conversationId);
    if (running) {
      running.dirty = true;
      return running.done;
    }
    const entry: QueueEntry = { dirty: false, done: Promise.resolve() };
    entry.done = new Promise<void>((resolve) => setImmediate(resolve)).then(
      async () => {
        try {
          let triggerId = messageId;
          do {
            entry.dirty = false;
            await this.run(conversationId, triggerId);
            triggerId = this.lastInboundId(conversationId) ?? triggerId;
          } while (entry.dirty);
        } finally {
          this.queue.delete(conversationId);
        }
      },
    );
    this.queue.set(conversationId, entry);
    return entry.done;
  }

  async status(now = new Date()) {
    const month = await this.usage.monthUsage(now);
    return {
      settings: this.settings.getAttendant(),
      apiKeyConfigured: !!this.client,
      model: this.config.anthropicModel,
      month,
    };
  }

  runs(conversationId: string, limit?: number) {
    return this.usage.recentRuns(conversationId, limit);
  }

  /** Reactivar pasado el tope no se puede: hay que subir el tope o esperar. */
  async updateSettings(
    data: Partial<AttendantSettings>,
    now = new Date(),
  ): Promise<AttendantSettings> {
    const current = this.settings.getAttendant();
    if (data.enabled && !current.enabled) {
      const budget = data.monthlyBudgetUsd ?? current.monthlyBudgetUsd;
      if ((await this.usage.monthSpentUsd(now)) >= budget) {
        throw new ConflictException('Subí el tope o esperá al mes que viene');
      }
      return this.settings.updateAttendant({ ...data, pausedByBudgetAt: null });
    }
    return this.settings.updateAttendant(data);
  }

  private async run(conversationId: string, triggerMessageId: string) {
    const model = this.config.anthropicModel;
    const tokens: AttendantUsage = {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    };
    const toolSummary: AgentToolSummary[] = [];
    const replyMessageIds: string[] = [];
    const save = async (outcome: AgentRunOutcome, error: string | null) => {
      await this.usage.save({
        conversationId,
        triggerMessageId,
        outcome,
        toolSummary,
        replyMessageIds,
        model,
        ...tokens,
        costUsd: costUsd(tokens),
        error,
      });
    };
    const skip = (reason: string) => {
      toolSummary.push({
        tool: 'salteo',
        label: 'No respondió',
        detail: reason,
      });
      return save('skipped', null);
    };

    try {
      const now = new Date();
      const settings = this.settings.getAttendant();
      // Estos dos no se guardan: pasarían con cada mensaje mientras esté así.
      if (!settings.enabled) {
        this.logger.debug(`${conversationId}: el agente está apagado`);
        return;
      }
      if (!this.client) {
        this.logger.debug(`${conversationId}: falta ANTHROPIC_API_KEY`);
        return;
      }
      const conversation =
        this.chatRepository.findConversationById(conversationId);
      if (!conversation) return await skip('El chat no existe');
      if (conversation.agentPaused) return await skip('El chat está pausado');
      if (this.isOwnerNumber(conversation.channel, conversation.externalId)) {
        return await skip('Es el número de Isaías');
      }
      const history = this.history(conversationId);
      const pending = this.pendingInbound(conversationId, history);
      if (!pending.length) {
        return await skip('No hay mensajes nuevos del cliente');
      }
      if (await this.budgetReached(settings, now)) {
        return await skip('Llegó al tope de gasto del mes');
      }

      const customer = conversation.customerId
        ? this.customers.findById(conversation.customerId)
        : undefined;
      const system: Anthropic.TextBlockParam[] = [
        {
          type: 'text',
          text: ATTENDANT_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
        {
          type: 'text',
          text: attendantContext({
            today: arTodayKey(now),
            channel: CHANNEL_LABELS[conversation.channel],
            displayName: conversation.displayName,
            displayPhone: conversation.displayPhone,
            customer: customer
              ? { name: customer.name, type: customer.type }
              : null,
          }),
        },
      ];
      this.processedUntil.set(conversationId, pending[pending.length - 1].id);
      // Lo nuevo del cliente va al final, aunque el agente haya respondido después.
      const messages = this.toMessages(
        [...history.filter((m) => !pending.includes(m)), ...pending].slice(
          -HISTORY_LIMIT,
        ),
      );
      const ctx = { conversationId, settings, now, replyMessageIds };
      let finalTool: string | null = null;
      let lastText = '';

      for (let turn = 0; turn < MAX_TURNS && !finalTool; turn += 1) {
        const response = await this.client.messages.create(
          {
            model,
            max_tokens: MAX_TOKENS,
            system,
            tools: ATTENDANT_TOOLS,
            messages,
          },
          { timeout: REQUEST_TIMEOUT_MS },
        );
        tokens.inputTokens += response.usage.input_tokens;
        tokens.outputTokens += response.usage.output_tokens;
        tokens.cacheReadTokens += response.usage.cache_read_input_tokens ?? 0;
        tokens.cacheWriteTokens +=
          response.usage.cache_creation_input_tokens ?? 0;
        messages.push({ role: 'assistant', content: response.content });
        lastText = response.content
          .filter((block) => block.type === 'text')
          .map((block) => block.text)
          .join('\n')
          .trim();

        const toolUses = response.content.filter(
          (block) => block.type === 'tool_use',
        );
        if (!toolUses.length) break;
        const results: Anthropic.ToolResultBlockParam[] = [];
        for (const toolUse of toolUses) {
          try {
            const output = await this.tools.execute(
              toolUse.name,
              toolUse.input as Record<string, unknown>,
              ctx,
            );
            toolSummary.push(output.summary);
            results.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: JSON.stringify(output.result),
            });
            if (FINAL_TOOLS.includes(toolUse.name)) finalTool = toolUse.name;
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Error';
            toolSummary.push({
              tool: toolUse.name,
              label: toolLabel(toolUse.name),
              detail: `error: ${message}`,
            });
            results.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: message,
              is_error: true,
            });
          }
        }
        messages.push({ role: 'user', content: results });
      }

      if (finalTool === 'derivar') await save('handed_off', null);
      else if (finalTool === 'responder') await save('replied', null);
      else if (lastText) {
        // Terminó sin responder ni derivar: lo que escribió queda para aprobar.
        this.chats.createSuggestion(conversationId, { text: lastText });
        await save('suggested', null);
      } else {
        await save('error', 'El agente no llegó a responder');
      }
      await this.budgetReached(settings, new Date());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Agente de atención en ${conversationId}: ${message}`);
      await save('error', message).catch(() => undefined);
    }
  }

  /** Al llegar al tope se pausa solo y le avisa a Isaías. */
  private async budgetReached(
    settings: AttendantSettings,
    now: Date,
  ): Promise<boolean> {
    const spent = await this.usage.monthSpentUsd(now);
    if (spent < settings.monthlyBudgetUsd) return false;
    if (this.settings.getAttendant().enabled) {
      this.settings.updateAttendant({
        enabled: false,
        pausedByBudgetAt: now.toISOString(),
      });
      await this.notifier.notifyOwnerWhatsApp(
        `El agente se pausó: llegó al tope de USD ${settings.monthlyBudgetUsd} del mes`,
      );
    }
    return true;
  }

  private isOwnerNumber(channel: ChatChannel, externalId: string): boolean {
    const owner = onlyDigits(this.config.alertsWhatsAppTo).slice(-10);
    return (
      channel === ChatChannel.WHATSAPP &&
      !!owner &&
      onlyDigits(externalId).slice(-10) === owner
    );
  }

  /** Mensajes que vio el cliente (sin descartados ni sugerencias), en orden. */
  private history(conversationId: string): ChatMessage[] {
    return this.chatRepository
      .findAllMessages()
      .filter(
        (message) =>
          message.conversationId === conversationId &&
          message.status !== ChatMessageStatus.DISCARDED &&
          message.status !== ChatMessageStatus.SUGGESTED,
      )
      .sort((a, b) => a.sentAt.localeCompare(b.sentAt));
  }

  /**
   * Mensajes del cliente que todavía no procesó ninguna corrida: los posteriores
   * al último procesado o, sin esa referencia, los posteriores a la última
   * respuesta de Odell.
   */
  private pendingInbound(
    conversationId: string,
    history: ChatMessage[],
  ): ChatMessage[] {
    const processedId = this.processedUntil.get(conversationId);
    const processedIndex = processedId
      ? history.findIndex((message) => message.id === processedId)
      : -1;
    const start =
      processedIndex >= 0
        ? processedIndex + 1
        : history.findLastIndex(
            (message) => message.direction === ChatDirection.OUT,
          ) + 1;
    return history
      .slice(start)
      .filter((message) => message.direction === ChatDirection.IN);
  }

  private lastInboundId(conversationId: string): string | null {
    return (
      this.history(conversationId)
        .filter((message) => message.direction === ChatDirection.IN)
        .pop()?.id ?? null
    );
  }

  /** Cliente = user, Odell = assistant; mensajes seguidos del mismo lado se juntan. */
  private toMessages(history: ChatMessage[]): Anthropic.MessageParam[] {
    const messages: { role: 'user' | 'assistant'; content: string }[] = [];
    for (const message of history) {
      const role =
        message.direction === ChatDirection.IN ? 'user' : 'assistant';
      const text =
        message.text ||
        message.attachments.map((file) => `[Adjunto: ${file.name}]`).join(' ');
      if (!messages.length && role === 'assistant') continue;
      const last = messages[messages.length - 1];
      if (last?.role === role) last.content += `\n${text}`;
      else messages.push({ role, content: text });
    }
    return messages;
  }
}
