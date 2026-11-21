import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { NgTemplateOutlet } from '@angular/common';
import { DbButtonComponent } from '@general-components';
import {
  AgentRun,
  AttendantStatus,
  ChatDetail,
  CurrentUserProfile,
} from '../../../core/models';
import { SettingsService } from '../../../core/services/settings.service';
import { UserAccessService } from '../../../core/services/user-access.service';
import { extractApiErrorMessage } from '../../../shared/utils/api-error';
import { agentLastReview, agentStateLabel } from '../chats.util';

/** Estado del agente de atención en el chat y qué revisó (§28.3). */
@Component({
  selector: 'app-chat-agent-panel',
  standalone: true,
  imports: [NgTemplateOutlet, DbButtonComponent],
  templateUrl: './chat-agent-panel.component.html',
  styleUrl: './chat-agent-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatAgentPanelComponent {
  private readonly settingsService = inject(SettingsService);
  private readonly userAccess = inject(UserAccessService);

  readonly detail = input.required<ChatDetail>();
  readonly status = input<AttendantStatus | null>(null);
  readonly runs = input<AgentRun[]>([]);
  readonly mobile = input(false);
  /** Se prendió o apagó el agente: hay que recargar el estado. */
  readonly statusChange = output<void>();

  readonly saving = signal(false);
  readonly error = signal('');

  private readonly profile = toSignal(
    this.userAccess.currentUser$.pipe(
      map((value) =>
        value && 'authenticated' in value && value.authenticated === false
          ? null
          : (value as CurrentUserProfile | null),
      ),
    ),
    { initialValue: null },
  );

  readonly isAdmin = computed(() => !!this.profile()?.isAdmin);
  readonly state = computed(() => agentStateLabel(this.detail().conversation, this.status()));
  readonly review = computed(() => agentLastReview(this.runs()));
  readonly enabled = computed(() => !!this.status()?.settings.enabled);

  toggle(): void {
    if (!this.status() || this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    this.settingsService.updateAttendant({ enabled: !this.enabled() }).subscribe({
      next: () => {
        this.saving.set(false);
        this.statusChange.emit();
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(extractApiErrorMessage(err, 'No se pudo cambiar el agente'));
      },
    });
  }
}
