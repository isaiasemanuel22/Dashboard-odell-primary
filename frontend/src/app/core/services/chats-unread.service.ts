import { Injectable, inject, signal } from '@angular/core';
import { ChatsService } from './chats.service';
import { RealtimeService } from './realtime.service';

/** Conversaciones sin leer (badge del menú). El número lo da el backend. */
@Injectable({ providedIn: 'root' })
export class ChatsUnreadService {
  private readonly chats = inject(ChatsService);

  readonly count = signal(0);

  constructor() {
    inject(RealtimeService)
      .watchScopes('chats')
      .subscribe(() => this.refresh());
  }

  refresh(): void {
    this.chats.unreadCount().subscribe({
      next: ({ unreadConversations }) => this.count.set(unreadConversations),
      error: () => undefined,
    });
  }
}
