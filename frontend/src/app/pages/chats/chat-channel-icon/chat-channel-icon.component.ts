import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ChatChannel } from '../../../core/models';

/** Ícono de trazo de WhatsApp, Instagram o Messenger (decorativo). */
@Component({
  selector: 'app-chat-channel-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './chat-channel-icon.component.scss',
  template: `
    <svg
      viewBox="0 0 24 24"
      [attr.width]="size()"
      [attr.height]="size()"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      [class]="'chat-channel-icon chat-channel-icon--' + channel()"
    >
      @switch (channel()) {
        @case ('whatsapp') {
          <path d="M20 12a8 8 0 0 1-11.7 7.1L4 20l1-4.2A8 8 0 1 1 20 12z" />
          <path d="M9.5 9.5c0 3 2 5 5 5l1-1.5-2-1-1 .8c-.8-.4-1.4-1-1.8-1.8l.8-1-1-2z" />
        }
        @case ('instagram') {
          <rect x="4" y="4" width="16" height="16" rx="5" />
          <circle cx="12" cy="12" r="3.6" />
          <path d="M16.6 7.4h.01" />
        }
        @case ('messenger') {
          <path d="M12 4C7.6 4 4 7.2 4 11.2c0 2.2 1 4.1 2.6 5.4V20l3-1.7c.7.2 1.5.3 2.4.3 4.4 0 8-3.2 8-7.2S16.4 4 12 4z" />
          <path d="M8 13l3-3 2 2 3-3" />
        }
      }
    </svg>
  `,
})
export class ChatChannelIconComponent {
  readonly channel = input.required<ChatChannel>();
  readonly size = input(14);
}
