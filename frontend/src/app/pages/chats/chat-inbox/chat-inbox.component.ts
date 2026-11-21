import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  DbButtonComponent,
  DbSkeletonComponent,
  MobileListToolbarComponent,
  type MobileListToolbarChip,
} from '@general-components';
import {
  ChatChannel,
  ChatCounts,
  ChatFilter,
  ChatSummary,
} from '../../../core/models';
import { ChatChannelIconComponent } from '../chat-channel-icon/chat-channel-icon.component';
import {
  CHAT_CHANNEL_LABELS,
  chatAvatar,
  chatListPill,
  chatListTime,
  chatTitle,
} from '../chats.util';

const CHANNELS: ChatChannel[] = ['whatsapp', 'instagram', 'messenger'];

@Component({
  selector: 'app-chat-inbox',
  standalone: true,
  imports: [
    RouterLink,
    DbButtonComponent,
    DbSkeletonComponent,
    MobileListToolbarComponent,
    ChatChannelIconComponent,
  ],
  templateUrl: './chat-inbox.component.html',
  styleUrl: './chat-inbox.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatInboxComponent {
  readonly variant = input<'desktop' | 'mobile'>('desktop');
  readonly conversations = input<ChatSummary[]>([]);
  readonly counts = input<ChatCounts | null>(null);
  readonly channel = input<ChatChannel | null>(null);
  readonly filter = input<ChatFilter | null>(null);
  readonly search = input('');
  readonly selectedId = input<string | null>(null);
  readonly loading = input(false);
  readonly loadError = input(false);

  readonly channelChange = output<ChatChannel | null>();
  readonly filterChange = output<ChatFilter | null>();
  readonly searchChange = output<string>();
  readonly retry = output<void>();

  readonly channels = CHANNELS;
  readonly channelLabels = CHAT_CHANNEL_LABELS;
  readonly title = chatTitle;
  readonly avatar = chatAvatar;
  readonly pill = chatListPill;
  readonly time = chatListTime;

  readonly statusChips = computed(() => {
    const counts = this.counts();
    return [
      { id: 'unread' as const, label: 'Sin leer', count: counts?.unread },
      { id: 'pending_approval' as const, label: 'Para aprobar', count: counts?.pendingApproval },
      { id: 'handed_off' as const, label: 'Derivados al humano', count: counts?.handedOff },
    ];
  });

  readonly mobileChannelChips = computed<MobileListToolbarChip[]>(() => {
    const counts = this.counts();
    return [
      { id: 'all', label: 'Todos', count: counts?.all },
      ...CHANNELS.map((channel) => ({
        id: channel,
        label: CHAT_CHANNEL_LABELS[channel],
        count: counts?.byChannel[channel],
      })),
    ];
  });

  readonly emptyMessage = computed(() =>
    this.channel() || this.filter() || this.search().trim()
      ? 'No hay chats con este filtro.'
      : 'Todavía no hay chats. Cuando un cliente escriba por WhatsApp, Instagram o Messenger, aparece acá.',
  );

  onMobileChannel(id: string): void {
    this.channelChange.emit(id === 'all' ? null : (id as ChatChannel));
  }

  /** Los chips de estado se prenden y apagan (sin «Todos»). */
  toggleFilter(id: ChatFilter): void {
    this.filterChange.emit(this.filter() === id ? null : id);
  }
}
