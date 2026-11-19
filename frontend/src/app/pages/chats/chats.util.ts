import {
  AgentRun,
  AttendantStatus,
  ChatChannel,
  ChatDetail,
  ChatSummary,
} from '../../core/models';
import { nameInitials } from '../../shared/utils/name-initials.util';
import { formatFairTime } from '../../shared/utils/fair.util';
import { formatPhoneArDisplay } from '../../shared/utils/phone-ar.util';
import { formatOpenedAgo } from '../../shared/utils/relative-day.util';

export const CHAT_CHANNEL_LABELS: Record<ChatChannel, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  messenger: 'Messenger',
};

export interface ChatListPill {
  label: string;
  tone: 'w' | 'b' | 'd' | 'neutral';
}

/** Etiqueta de la fila de la bandeja, según lo que manda el backend. */
export function chatListPill(summary: ChatSummary): ChatListPill | null {
  if (summary.status === 'pending_approval') return { label: 'Aprobar', tone: 'w' };
  if (summary.status === 'handed_off') return { label: 'Te derivó', tone: 'b' };
  if (!summary.windowOpen) return { label: 'Ventana cerrada', tone: 'd' };
  if (summary.lastMessageDirection === 'out') return { label: 'Respondido', tone: 'neutral' };
  return null;
}

export interface AgentStatePill {
  label: string;
  tone: 'ok' | 'b' | 'd' | 'neutral';
}

/** Estado del agente en el chat: primero el apagado global, después el del chat (§28.3). */
export function agentStateLabel(
  summary: ChatSummary,
  status: AttendantStatus | null,
): AgentStatePill {
  const settings = status?.settings;
  if (settings && !settings.enabled) {
    return settings.pausedByBudgetAt
      ? { label: 'Pausado por tope', tone: 'd' }
      : { label: 'Agente apagado', tone: 'neutral' };
  }
  if (summary.status === 'handed_off') return { label: 'Te derivó', tone: 'b' };
  if (summary.agentPaused) return { label: 'Pausado en este chat', tone: 'neutral' };
  return { label: 'Agente activo', tone: 'ok' };
}

/** Lo que revisó el agente en su última corrida con respuesta, derivación o sugerencia. */
export function agentLastReview(runs: AgentRun[]): AgentRun['toolSummary'] {
  const run = runs.find((r) => ['replied', 'handed_off', 'suggested'].includes(r.outcome));
  return run?.toolSummary ?? [];
}

/** Nombre del contacto; sin nombre, el teléfono. */
export function chatTitle(summary: ChatSummary): string {
  return (
    summary.contactName?.trim() ||
    summary.displayName?.trim() ||
    formatPhoneArDisplay(summary.displayPhone) ||
    summary.externalId
  );
}

/** Vinculado a un cliente: el nombre con el que escribe, si no es el del cliente. */
export function chatWritesAs(detail: ChatDetail): string {
  const shown = detail.conversation.displayName?.trim();
  const customer = detail.customer?.name.trim();
  if (!shown || !customer) return '';
  return shown.toLocaleLowerCase('es-AR') === customer.toLocaleLowerCase('es-AR') ? '' : shown;
}

export function chatAvatar(summary: ChatSummary): string {
  const name = summary.contactName?.trim() || summary.displayName?.trim();
  return name ? nameInitials(name) : '··';
}

/** «WhatsApp · +54 9 351 555-0142». */
export function chatChannelLine(summary: ChatSummary): string {
  const phone = formatPhoneArDisplay(summary.displayPhone);
  const channel = CHAT_CHANNEL_LABELS[summary.channel];
  return phone ? `${channel} · ${phone}` : channel;
}

/** «WhatsApp · +54 9 351 555-0142 · Escribe como Café Aurora». */
export function chatContactLine(detail: ChatDetail): string {
  const line = chatChannelLine(detail.conversation);
  const writesAs = chatWritesAs(detail);
  return writesAs ? `${line} · Escribe como ${writesAs}` : line;
}

/** «quedan 21 h 18 min» hasta el cierre de la ventana. */
export function formatWindowLeft(
  expiresAt: string | null | undefined,
  now: Date = new Date(),
): string {
  const left = formatWindowDuration(expiresAt, now);
  return left ? `quedan ${left}` : '';
}

/** «21 h 18 min» hasta el cierre de la ventana. */
export function formatWindowDuration(
  expiresAt: string | null | undefined,
  now: Date = new Date(),
): string {
  if (!expiresAt) return '';
  const ms = new Date(expiresAt).getTime() - now.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  return `${hours} h ${minutes} min`;
}

/** Hora del último mensaje en la bandeja: «15:42», «ayer» o «16/11». */
export function chatListTime(
  iso: string | null | undefined,
  now: Date = new Date(),
): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const ago = formatOpenedAgo(iso, now);
  if (ago === 'hoy') return chatTime(iso);
  if (ago === 'ayer') return 'ayer';
  return chatDayMonth(date);
}

/** «15:42», en 24 h. */
export function chatTime(iso: string): string {
  return formatFairTime(iso);
}

/** Separador de día en la conversación: «Hoy · miércoles 18/11». */
export function chatDayLabel(iso: string, now: Date = new Date()): string {
  const day = chatWeekdayDay(new Date(iso));
  const ago = formatOpenedAgo(iso, now);
  if (ago === 'hoy') return `Hoy · ${day}`;
  if (ago === 'ayer') return `Ayer · ${day}`;
  return day;
}

/** «jueves 19/11 a las 15:42». */
export function chatDateTimeLong(iso: string): string {
  return `${chatWeekdayDay(new Date(iso))} a las ${chatTime(iso)}`;
}

/** «16/11», en hora local. */
function chatDayMonth(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

/** «miércoles 18/11», en hora local. */
function chatWeekdayDay(date: Date): string {
  return `${date.toLocaleDateString('es-AR', { weekday: 'long' })} ${chatDayMonth(date)}`;
}
