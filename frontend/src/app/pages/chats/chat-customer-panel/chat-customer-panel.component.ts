import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Observable, catchError, map, of, switchMap } from 'rxjs';
import {
  DbButtonComponent,
  MobileSheetComponent,
} from '@general-components';
import { ChatDetail, QuoteStatus } from '../../../core/models';
import { ChatsService } from '../../../core/services/chats.service';
import { DataChangedService } from '../../../core/services/data-changed.service';
import { FormDialogService } from '../../../modals/public-api';
import { QUOTE_STATUS_LABELS } from '../../../shared/constants/labels';
import { CurrencyArsPipe } from '../../../shared/pipes/labels.pipe';
import { extractApiErrorMessage } from '../../../shared/utils/api-error';
import { formatDateDayMonth } from '../../../shared/utils/date-format.util';
import { nameInitials } from '../../../shared/utils/name-initials.util';
import {
  customerSourceLabel,
  customerTypeLabel,
} from '../../../shared/utils/v1-labels.util';
import { ChatChannelIconComponent } from '../chat-channel-icon/chat-channel-icon.component';
import { chatChannelLine, chatWritesAs } from '../chats.util';

@Component({
  selector: 'app-chat-customer-panel',
  standalone: true,
  imports: [
    RouterLink,
    DbButtonComponent,
    MobileSheetComponent,
    CurrencyArsPipe,
    ChatChannelIconComponent,
  ],
  templateUrl: './chat-customer-panel.component.html',
  styleUrl: './chat-customer-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatCustomerPanelComponent {
  private readonly chats = inject(ChatsService);
  private readonly formDialogs = inject(FormDialogService);
  private readonly dataChanged = inject(DataChangedService);

  readonly detail = input.required<ChatDetail>();
  /** `panel`: columna derecha en escritorio; `bar`: fila de acciones en mobile. */
  readonly variant = input<'panel' | 'bar'>('panel');
  readonly changed = output<void>();

  readonly menuOpen = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');

  readonly conversation = computed(() => this.detail().conversation);
  readonly customer = computed(() => this.detail().customer);
  readonly context = computed(() => this.detail().customerContext);
  readonly channelLine = computed(() => chatChannelLine(this.conversation()));
  readonly writesAs = computed(() => chatWritesAs(this.detail()));
  readonly initials = computed(() => nameInitials(this.customer()?.name));
  readonly typeLabel = computed(() => customerTypeLabel(this.customer()?.type));
  readonly sourceLabel = computed(() => customerSourceLabel(this.customer()?.source) || '—');

  readonly formatDate = formatDateDayMonth;

  quoteStatusLabel(status: string): string {
    return QUOTE_STATUS_LABELS[status as QuoteStatus] ?? status;
  }

  openMenu(): void {
    this.menuOpen.set(true);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  createQuote(): void {
    this.formDialogs
      .openQuote(null, { presetCustomerId: this.customer()?.id })
      .subscribe((saved) => {
        if (!saved) return;
        this.dataChanged.emit('quotes');
        this.changed.emit();
      });
  }

  /** El pedido exige cliente: sin vínculo, primero se vincula. */
  createOrder(): void {
    const current = this.customer()?.id;
    const customerId$: Observable<string | undefined> = current
      ? of(current)
      : this.pickAndLink(
          'Para crear el pedido, primero vinculá el chat a un cliente.',
        );
    customerId$
      .pipe(
        switchMap((customerId) =>
          customerId
            ? this.formDialogs.openOrder(null, { presetCustomerId: customerId })
            : of(undefined),
        ),
      )
      .subscribe((saved) => {
        if (!saved) return;
        this.dataChanged.emit('orders');
        this.changed.emit();
      });
  }

  linkCustomer(): void {
    this.closeMenu();
    this.pickAndLink().subscribe();
  }

  unlinkCustomer(): void {
    this.closeMenu();
    this.busy.set(true);
    this.error.set('');
    this.chats.unlinkCustomer(this.conversation().id).subscribe({
      next: () => {
        this.busy.set(false);
        this.changed.emit();
      },
      error: (err) => {
        this.busy.set(false);
        this.error.set(extractApiErrorMessage(err, 'No se pudo desvincular el cliente'));
      },
    });
  }

  /** Elige un cliente y lo vincula; devuelve el id vinculado. */
  private pickAndLink(hint?: string): Observable<string | undefined> {
    const conversationId = this.conversation().id;
    return this.formDialogs
      .openChatLinkCustomer({ customerId: this.customer()?.id ?? null, hint })
      .pipe(
        switchMap((customerId) => {
          if (!customerId) return of(undefined);
          this.busy.set(true);
          this.error.set('');
          return this.chats.linkCustomer(conversationId, customerId).pipe(
            map(() => {
              this.busy.set(false);
              this.changed.emit();
              return customerId;
            }),
            catchError((err) => {
              this.busy.set(false);
              this.error.set(extractApiErrorMessage(err, 'No se pudo vincular el cliente'));
              return of(undefined);
            }),
          );
        }),
      );
  }
}
