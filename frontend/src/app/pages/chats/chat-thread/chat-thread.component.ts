import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import {
  DbButtonComponent,
  FileUploadSession,
} from '@general-components';
import {
  ChatDetail,
  ChatMessage,
  ProductAttachment,
} from '../../../core/models';
import { MediaUploadService } from '../../../core/services/media-upload.service';
import { ChatsService } from '../../../core/services/chats.service';
import { CurrencyArsPipe, MediaUrlPipe } from '../../../shared/pipes/labels.pipe';
import { extractApiErrorMessage } from '../../../shared/utils/api-error';
import { createProductAttachmentId } from '../../../shared/utils/product-attachment.helpers';
import { ChatChannelIconComponent } from '../chat-channel-icon/chat-channel-icon.component';
import { CHAT_QUICK_REPLIES } from '../chats.constants';
import {
  CHAT_CHANNEL_LABELS,
  chatAvatar,
  chatContactLine,
  chatDateTimeLong,
  chatDayLabel,
  chatTime,
  chatTitle,
  formatWindowDuration,
  formatWindowLeft,
} from '../chats.util';

type ThreadItem =
  | { kind: 'day'; key: string; label: string }
  | { kind: 'message'; key: string; message: ChatMessage };

@Component({
  selector: 'app-chat-thread',
  standalone: true,
  imports: [DbButtonComponent, CurrencyArsPipe, MediaUrlPipe, ChatChannelIconComponent],
  templateUrl: './chat-thread.component.html',
  styleUrl: './chat-thread.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatThreadComponent {
  private readonly chats = inject(ChatsService);
  private readonly mediaUpload = inject(MediaUploadService);

  readonly detail = input.required<ChatDetail>();
  readonly mobile = input(false);
  readonly changed = output<void>();

  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private readonly textarea = viewChild<ElementRef<HTMLTextAreaElement>>('composer');
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  readonly quickReplies = CHAT_QUICK_REPLIES;
  readonly time = chatTime;

  readonly draft = signal('');
  readonly attachments = signal<ProductAttachment[]>([]);
  readonly uploading = signal(false);
  readonly sending = signal(false);
  readonly error = signal('');
  readonly editingId = signal<string | null>(null);
  readonly editText = signal('');
  readonly busySuggestionId = signal<string | null>(null);
  readonly resuming = signal(false);
  /** Reloj para la cuenta regresiva de la ventana. */
  private readonly now = signal(new Date());

  readonly conversation = computed(() => this.detail().conversation);
  readonly title = computed(() => chatTitle(this.conversation()));
  readonly avatar = computed(() => chatAvatar(this.conversation()));
  readonly contactLine = computed(() => chatContactLine(this.detail()));
  readonly channelLabel = computed(() => CHAT_CHANNEL_LABELS[this.conversation().channel]);
  /** Nombre corto para «Martina · 15:42» y los textos de ayuda. */
  readonly firstName = computed(() => {
    const c = this.conversation();
    const name = c.contactName?.trim() || c.displayName?.trim();
    return name ? name.split(/\s+/)[0] : 'el cliente';
  });
  readonly windowOpen = computed(() => this.conversation().windowOpen);
  readonly agentPaused = computed(() => this.conversation().agentPaused);
  /** « · quedan 21 h 18 min», o vacío si no hay vencimiento. */
  readonly windowLeftSuffix = computed(() => {
    const left = formatWindowLeft(this.conversation().windowExpiresAt, this.now());
    return left ? ` · ${left}` : '';
  });
  /** Píldora corta del encabezado: «Abierta · 19 h 10 min». */
  readonly windowPill = computed(() => {
    const left = formatWindowDuration(this.conversation().windowExpiresAt, this.now());
    return left ? `Abierta · ${left}` : 'Abierta';
  });
  readonly windowUntil = computed(() => {
    const expiresAt = this.conversation().windowExpiresAt;
    return expiresAt ? chatDateTimeLong(expiresAt) : '';
  });

  readonly items = computed<ThreadItem[]>(() => {
    const items: ThreadItem[] = [];
    let lastDay = '';
    for (const message of this.detail().messages) {
      if (message.status === 'discarded') continue;
      const day = new Date(message.sentAt).toDateString();
      if (day !== lastDay) {
        lastDay = day;
        items.push({ kind: 'day', key: `day-${day}`, label: chatDayLabel(message.sentAt) });
      }
      items.push({ kind: 'message', key: message.id, message });
    }
    return items;
  });

  readonly canSend = computed(
    () =>
      this.windowOpen() &&
      !this.sending() &&
      !this.uploading() &&
      (!!this.draft().trim() || this.attachments().length > 0),
  );

  constructor() {
    const timer = setInterval(() => this.now.set(new Date()), 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));

    // Otra conversación: se vacía la caja.
    let lastId = '';
    effect(() => {
      const id = this.conversation().id;
      if (id === lastId) return;
      lastId = id;
      untracked(() => {
        this.draft.set('');
        this.attachments.set([]);
        this.error.set('');
        this.editingId.set(null);
      });
    });

    // Al llegar mensajes, bajar hasta el último.
    effect(() => {
      this.items().length;
      const el = this.scroller()?.nativeElement;
      if (!el) return;
      requestAnimationFrame(() => (el.scrollTop = el.scrollHeight));
    });
  }

  suggestionQuote(message: ChatMessage) {
    return message.quoteId ? this.detail().suggestionQuotes[message.quoteId] ?? null : null;
  }

  messageMeta(message: ChatMessage): string {
    const at = chatTime(message.sentAt);
    if (message.direction === 'in') return `${this.firstName()} · ${at}`;
    const by = message.author === 'agent' ? 'Enviado por el agente' : 'Enviado por vos';
    return `${by} · ${at}`;
  }

  isImage(attachment: ProductAttachment): boolean {
    return attachment.mimeType?.startsWith('image/') ?? false;
  }

  insertQuickReply(text: string): void {
    const current = this.draft();
    this.draft.set(current.trim() ? `${current.replace(/\s+$/, '')}\n${text}` : text);
    this.textarea()?.nativeElement.focus();
  }

  pickFile(accept: string): void {
    const el = this.fileInput()?.nativeElement;
    if (!el) return;
    el.accept = accept;
    el.click();
  }

  onFiles(event: Event): void {
    const files = FileUploadSession.fromInput(event);
    if (!files.length) return;
    this.error.set('');
    this.uploading.set(true);
    forkJoin(
      files.map((file) => this.mediaUpload.uploadDocumentAttachment(file, 'chats')),
    ).subscribe({
      next: (uploaded) => {
        this.attachments.update((list) => [
          ...list,
          ...uploaded.map((meta) => ({ id: createProductAttachmentId(), ...meta })),
        ]);
        this.uploading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(FileUploadSession.uploadError(err));
        this.uploading.set(false);
      },
    });
  }

  removeAttachment(id: string): void {
    this.attachments.update((list) => list.filter((item) => item.id !== id));
  }

  send(): void {
    if (!this.canSend()) return;
    const attachments = this.attachments();
    this.sending.set(true);
    this.error.set('');
    this.chats
      .send(this.conversation().id, {
        text: this.draft().trim(),
        ...(attachments.length ? { attachments } : {}),
      })
      .subscribe({
        next: () => {
          this.sending.set(false);
          this.draft.set('');
          this.attachments.set([]);
          this.changed.emit();
        },
        error: (err: HttpErrorResponse) => {
          this.sending.set(false);
          this.error.set(sendErrorMessage(err));
        },
      });
  }

  resumeAgent(): void {
    this.resuming.set(true);
    this.error.set('');
    this.chats.setAgentPaused(this.conversation().id, false).subscribe({
      next: () => {
        this.resuming.set(false);
        this.changed.emit();
      },
      error: (err: HttpErrorResponse) => {
        this.resuming.set(false);
        this.error.set(sendErrorMessage(err));
      },
    });
  }

  startEdit(message: ChatMessage): void {
    this.editingId.set(message.id);
    this.editText.set(message.text);
  }

  cancelEdit(): void {
    this.editingId.set(null);
  }

  saveEdit(message: ChatMessage): void {
    const text = this.editText().trim();
    if (!text) return;
    this.runSuggestion(message, this.chats.editSuggestion(this.conversation().id, message.id, text));
  }

  approve(message: ChatMessage): void {
    const edited = this.editingId() === message.id ? this.editText().trim() : undefined;
    if (edited === '') return;
    this.runSuggestion(
      message,
      this.chats.approveSuggestion(this.conversation().id, message.id, edited),
    );
  }

  discard(message: ChatMessage): void {
    this.runSuggestion(message, this.chats.discardSuggestion(this.conversation().id, message.id));
  }

  private runSuggestion(
    message: ChatMessage,
    request: ReturnType<ChatsService['discardSuggestion']>,
  ): void {
    this.busySuggestionId.set(message.id);
    this.error.set('');
    request.subscribe({
      next: () => {
        this.busySuggestionId.set(null);
        this.editingId.set(null);
        this.changed.emit();
      },
      error: (err: HttpErrorResponse) => {
        this.busySuggestionId.set(null);
        this.error.set(sendErrorMessage(err));
      },
    });
  }
}

/** 409: ventana cerrada; 502: el canal no aceptó el envío. */
function sendErrorMessage(err: HttpErrorResponse): string {
  const fallback =
    err.status === 409
      ? 'La ventana de 24 h está cerrada: no se puede mandar texto libre.'
      : err.status === 502
        ? 'El canal no aceptó el mensaje. Probá de nuevo en un rato.'
        : 'No se pudo completar la acción.';
  return extractApiErrorMessage(err, fallback);
}
