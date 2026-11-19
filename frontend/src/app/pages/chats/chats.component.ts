import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Location } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  Subject,
  catchError,
  debounceTime,
  forkJoin,
  map,
  of,
  switchMap,
} from 'rxjs';
import {
  DbButtonComponent,
  DbSkeletonComponent,
  DbStateMessageComponent,
  MobileBarComponent,
} from '@general-components';
import {
  AgentRun,
  AttendantStatus,
  ChatChannel,
  ChatDetail,
  ChatFilter,
  ChatList,
} from '../../core/models';
import { AttendantService } from '../../core/services/attendant.service';
import { BreakpointService } from '../../core/services/breakpoint.service';
import { ChatsService } from '../../core/services/chats.service';
import { ChatsUnreadService } from '../../core/services/chats-unread.service';
import {
  MOBILE_LIST_KEYS,
  injectMobileListPersistence,
} from '../../core/services/mobile-list-state.service';
import { RealtimeService } from '../../core/services/realtime.service';
import { ChatAgentPanelComponent } from './chat-agent-panel/chat-agent-panel.component';
import { ChatChannelIconComponent } from './chat-channel-icon/chat-channel-icon.component';
import { ChatCustomerPanelComponent } from './chat-customer-panel/chat-customer-panel.component';
import { ChatInboxComponent } from './chat-inbox/chat-inbox.component';
import { ChatThreadComponent } from './chat-thread/chat-thread.component';
import { chatAvatar, chatContactLine, chatTitle } from './chats.util';

interface ChatsMobileListState {
  channel: ChatChannel | null;
  filter: ChatFilter | null;
  search: string;
  scrollY: number;
}

@Component({
  selector: 'app-chats',
  standalone: true,
  imports: [
    RouterLink,
    DbButtonComponent,
    DbSkeletonComponent,
    DbStateMessageComponent,
    MobileBarComponent,
    ChatInboxComponent,
    ChatThreadComponent,
    ChatCustomerPanelComponent,
    ChatChannelIconComponent,
    ChatAgentPanelComponent,
  ],
  templateUrl: './chats.component.html',
  styleUrl: './chats.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatsComponent implements OnInit {
  private readonly chatsService = inject(ChatsService);
  private readonly chatsUnread = inject(ChatsUnreadService);
  private readonly attendant = inject(AttendantService);
  private readonly realtime = inject(RealtimeService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly destroyRef = inject(DestroyRef);
  private readonly listPersistence =
    injectMobileListPersistence<ChatsMobileListState>(MOBILE_LIST_KEYS.chats);

  readonly isMobile = inject(BreakpointService).isMobile;
  readonly title = chatTitle;
  readonly avatar = chatAvatar;
  readonly contactLine = chatContactLine;

  readonly channel = signal<ChatChannel | null>(null);
  readonly filter = signal<ChatFilter | null>(null);
  readonly search = signal('');

  readonly list = signal<ChatList | null>(null);
  readonly listLoading = signal(true);
  readonly listError = signal(false);

  readonly selectedId = signal<string | null>(null);
  readonly detail = signal<ChatDetail | null>(null);
  readonly detailError = signal(false);
  readonly agentStatus = signal<AttendantStatus | null>(null);
  readonly agentRuns = signal<AgentRun[]>([]);

  readonly conversations = computed(() => this.list()?.conversations ?? []);
  readonly counts = computed(() => this.list()?.counts ?? null);

  private readonly listReload$ = new Subject<void>();
  private readonly searchInput$ = new Subject<string>();
  /** `markRead`: al abrir la conversación se marca leída. */
  private readonly detailReload$ = new Subject<{ id: string; markRead: boolean }>();

  ngOnInit(): void {
    this.listPersistence.connect(() => ({
      channel: this.channel(),
      filter: this.filter(),
      search: this.search(),
    }));
    this.listPersistence.restore((saved) => {
      this.channel.set(saved.channel);
      this.filter.set(saved.filter);
      this.search.set(saved.search);
    });

    this.listReload$
      .pipe(
        switchMap(() =>
          this.chatsService
            .list({
              channel: this.channel(),
              filter: this.filter(),
              search: this.search(),
            })
            .pipe(
              map((list) => ({ list })),
              catchError(() => of({ list: null })),
            ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ list }) => {
        this.listLoading.set(false);
        if (!list) {
          if (!this.list()) this.listError.set(true);
          return;
        }
        this.listError.set(false);
        this.list.set(list);
        this.listPersistence.onListReady();
      });

    this.searchInput$
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.search.set(value);
        this.listPersistence.persist({ keepScroll: true });
        this.reloadList();
      });

    this.detailReload$
      .pipe(
        switchMap(({ id, markRead }) =>
          forkJoin({
            detail: this.chatsService.get(id),
            // Sin corridas no se pierde el chat: el panel queda sin «Qué revisó».
            runs: this.attendant.runs(id).pipe(catchError(() => of([]))),
          }).pipe(
            map(({ detail, runs }) => ({ detail, runs, markRead })),
            catchError(() => of({ detail: null, runs: [], markRead })),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ detail, runs, markRead }) => {
        if (!detail) {
          this.detailError.set(true);
          return;
        }
        if (detail.conversation.id !== this.selectedId()) return;
        this.detailError.set(false);
        this.detail.set(detail);
        this.agentRuns.set(runs);
        if (markRead || detail.conversation.unreadCount > 0) {
          this.markRead(detail.conversation.id);
        }
      });

    this.route.paramMap
      .pipe(
        map((params) => params.get('id')),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((id) => {
        if (id === this.selectedId()) return;
        this.selectedId.set(id);
        this.detail.set(null);
        this.agentRuns.set([]);
        this.detailError.set(false);
        if (id) this.detailReload$.next({ id, markRead: true });
      });

    // Mensajes nuevos, sugerencias o lecturas desde otra pestaña o el agente.
    this.realtime.bindReload(this.destroyRef, 'chats', () => {
      this.reloadList();
      this.reloadDetail();
    });

    this.reloadList();
    this.reloadAgentStatus();
  }

  reloadList(): void {
    if (!this.list()) this.listLoading.set(true);
    this.listError.set(false);
    this.listReload$.next();
  }

  reloadDetail(): void {
    const id = this.selectedId();
    if (id) this.detailReload$.next({ id, markRead: false });
  }

  reloadAgentStatus(): void {
    this.attendant.status().subscribe({
      next: (status) => this.agentStatus.set(status),
      error: () => undefined,
    });
  }

  /** Después de enviar, aprobar, vincular, etc. */
  onChanged(): void {
    this.reloadList();
    this.reloadDetail();
    this.chatsUnread.refresh();
  }

  onChannelChange(channel: ChatChannel | null): void {
    this.channel.set(channel);
    this.listPersistence.persist({ keepScroll: true });
    this.reloadList();
  }

  onFilterChange(filter: ChatFilter | null): void {
    this.filter.set(filter);
    this.listPersistence.persist({ keepScroll: true });
    this.reloadList();
  }

  onSearchChange(value: string): void {
    this.searchInput$.next(value);
  }

  /** Como db-mobile-bar: vuelve en el historial si se llegó desde la app; si no, sigue el link. */
  onBack(event: Event): void {
    if (!this.router.lastSuccessfulNavigation?.previousNavigation) return;
    event.preventDefault();
    this.location.back();
  }

  private markRead(id: string): void {
    this.chatsService.markRead(id).subscribe({
      next: (summary) => {
        const current = this.detail();
        if (current?.conversation.id === summary.id) {
          this.detail.set({ ...current, conversation: summary });
        }
        const list = this.list();
        if (list) {
          this.list.set({
            ...list,
            conversations: list.conversations.map((chat) =>
              chat.id === summary.id ? summary : chat,
            ),
          });
        }
        this.chatsUnread.refresh();
      },
      error: () => undefined,
    });
  }
}
