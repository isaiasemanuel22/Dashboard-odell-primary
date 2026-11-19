import {
  AgentRun,
  AttendantStatus,
  ChatDetail,
  ChatSummary,
  Customer,
} from '../../core/models';
import {
  agentLastReview,
  agentStateLabel,
  chatAvatar,
  chatChannelLine,
  chatContactLine,
  chatDateTimeLong,
  chatDayLabel,
  chatListPill,
  chatListTime,
  chatTime,
  chatTitle,
  chatWritesAs,
  formatWindowDuration,
  formatWindowLeft,
} from './chats.util';

function summary(partial: Partial<ChatSummary> = {}): ChatSummary {
  return {
    id: 'chat-1',
    channel: 'whatsapp',
    externalId: '5493515550142',
    displayName: 'Martina Paz',
    displayPhone: '5493515550142',
    contactName: 'Martina Paz',
    customerId: null,
    status: 'open',
    unreadCount: 0,
    pendingSuggestions: 0,
    lastMessageAt: '2026-11-18T18:42:00.000Z',
    lastMessagePreview: 'Hola',
    lastMessageDirection: 'in',
    lastInboundAt: '2026-11-18T18:42:00.000Z',
    windowOpen: true,
    windowExpiresAt: '2026-11-19T18:42:00.000Z',
    agentPaused: false,
    ...partial,
  };
}

describe('chats.util', () => {
  it('chatListPill: aprobar, derivado, ventana cerrada, respondido o nada', () => {
    expect(chatListPill(summary({ status: 'pending_approval' }))?.label).toBe('Aprobar');
    expect(chatListPill(summary({ status: 'handed_off' }))?.label).toBe('Te derivó');
    expect(chatListPill(summary({ windowOpen: false }))?.label).toBe('Ventana cerrada');
    expect(chatListPill(summary({ lastMessageDirection: 'out' }))?.label).toBe('Respondido');
    expect(chatListPill(summary())).toBeNull();
  });

  it('chatAvatar: iniciales o ·· sin nombre', () => {
    expect(chatAvatar(summary())).toBe('MP');
    expect(chatAvatar(summary({ contactName: null, displayName: null }))).toBe('··');
  });

  it('chatTitle: sin nombre muestra el teléfono formateado', () => {
    expect(chatTitle(summary({ contactName: null, displayName: null }))).toBe(
      '+54 9 35 1555-0142',
    );
  });

  it('chatChannelLine: canal y teléfono', () => {
    expect(chatChannelLine(summary({ displayPhone: null }))).toBe('WhatsApp');
    expect(chatChannelLine(summary({ channel: 'instagram', displayPhone: null }))).toBe(
      'Instagram',
    );
  });

  it('formatWindowLeft: horas y minutos que quedan', () => {
    const now = new Date('2026-11-18T21:24:00.000Z');
    expect(formatWindowLeft('2026-11-19T18:42:00.000Z', now)).toBe('quedan 21 h 18 min');
    expect(formatWindowLeft('2026-11-18T21:50:00.000Z', now)).toBe('quedan 26 min');
    expect(formatWindowLeft('2026-11-18T20:00:00.000Z', now)).toBe('');
    expect(formatWindowLeft(null, now)).toBe('');
    expect(formatWindowDuration('2026-11-19T18:42:00.000Z', now)).toBe('21 h 18 min');
  });

  it('chatWritesAs: nombre con el que escribe si no es el del cliente vinculado', () => {
    const detail = (displayName: string | null, customerName: string | null): ChatDetail => ({
      conversation: summary({ displayName }),
      messages: [],
      suggestionQuotes: {},
      customer: customerName ? ({ name: customerName } as Customer) : null,
      customerContext: null,
    });
    expect(chatWritesAs(detail('Café Aurora', 'Lucía Gómez'))).toBe('Café Aurora');
    expect(chatWritesAs(detail('lucía gómez', 'Lucía Gómez'))).toBe('');
    expect(chatWritesAs(detail('Café Aurora', null))).toBe('');
    expect(chatWritesAs(detail(null, 'Lucía Gómez'))).toBe('');
    expect(chatContactLine(detail('Café Aurora', 'Lucía Gómez'))).toBe(
      'WhatsApp · +54 9 35 1555-0142 · Escribe como Café Aurora',
    );
    expect(chatContactLine(detail('lucía gómez', 'Lucía Gómez'))).toBe(
      'WhatsApp · +54 9 35 1555-0142',
    );
  });

  it('chatListTime: ayer y fecha corta', () => {
    const now = new Date('2026-11-18T18:00:00.000Z');
    expect(chatListTime('2026-11-17T18:00:00.000Z', now)).toBe('ayer');
    expect(chatListTime('2026-11-16T18:00:00.000Z', now)).toBe('16/11');
    expect(chatListTime(null, now)).toBe('');
  });

  it('formato de hora y fecha: 24 h y barra', () => {
    const now = new Date(2026, 10, 18, 18, 0);
    const today = new Date(2026, 10, 18, 15, 42).toISOString();
    const tomorrow = new Date(2026, 10, 19, 15, 42).toISOString();
    expect(chatTime(today)).toBe('15:42');
    expect(chatTime(new Date(2026, 10, 18, 0, 5).toISOString())).toBe('00:05');
    expect(chatListTime(today, now)).toBe('15:42');
    expect(chatListTime(new Date(2026, 10, 16, 10, 0).toISOString(), now)).toBe('16/11');
    expect(chatDayLabel(today, now)).toBe('Hoy · miércoles 18/11');
    expect(chatDayLabel(new Date(2026, 10, 17, 9, 0).toISOString(), now)).toBe(
      'Ayer · martes 17/11',
    );
    expect(chatDateTimeLong(tomorrow)).toBe('jueves 19/11 a las 15:42');
  });

  it('agentStateLabel: apagado y tope antes que el estado del chat', () => {
    const status = (enabled: boolean, pausedByBudgetAt: string | null = null) =>
      ({ settings: { enabled, pausedByBudgetAt } }) as AttendantStatus;
    const derived = summary({ status: 'handed_off', agentPaused: true });
    expect(agentStateLabel(summary(), status(true)).label).toBe('Agente activo');
    expect(agentStateLabel(summary({ agentPaused: true }), status(true)).label).toBe(
      'Pausado en este chat',
    );
    expect(agentStateLabel(derived, status(true)).label).toBe('Te derivó');
    expect(agentStateLabel(derived, null).label).toBe('Te derivó');
    expect(agentStateLabel(derived, status(false)).label).toBe('Agente apagado');
    expect(agentStateLabel(summary(), status(false, '2026-11-19T10:00:00.000Z')).label).toBe(
      'Pausado por tope',
    );
  });

  it('agentLastReview: última corrida que respondió, derivó o sugirió', () => {
    const run = (outcome: AgentRun['outcome'], label: string) =>
      ({ outcome, toolSummary: [{ tool: 't', label, detail: '' }] }) as AgentRun;
    expect(agentLastReview([run('skipped', 'A'), run('replied', 'B'), run('suggested', 'C')])).toEqual([
      { tool: 't', label: 'B', detail: '' },
    ]);
    expect(agentLastReview([run('error', 'A')])).toEqual([]);
    expect(agentLastReview([])).toEqual([]);
  });
});
