import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import {
  DbButtonComponent,
  DbCheckboxComponent,
  DbCheckboxGroupComponent,
  DbFormComponent,
  DbFormErrorComponent,
  DbFormFieldComponent,
  DbFormFooterComponent,
  DbInputComponent,
} from '@general-components';
import { ApiKeyScopeOption, CreatedApiKey } from '../core/models';
import { ApiKeysService } from '../core/services/api-keys.service';
import { extractApiErrorMessage } from '../shared/utils/api-error';
import { confirmMobileFormDiscard } from '../components/mobile-form-shell/confirm-mobile-form-discard';
import { FormDialogService } from './form-dialog.service';
import { guardDialogDismiss } from './dialog-dismiss-guard';
import { FormDialogShellComponent } from './form-dialog-shell/form-dialog-shell.component';

export interface ApiKeyFormDialogData {
  scopeOptions: ApiKeyScopeOption[];
}

@Component({
  standalone: true,
  imports: [
    FormsModule,
    FormDialogShellComponent,
    DbFormComponent,
    DbFormFieldComponent,
    DbInputComponent,
    DbCheckboxComponent,
    DbCheckboxGroupComponent,
    DbFormErrorComponent,
    DbFormFooterComponent,
    DbButtonComponent,
  ],
  template: `
    <app-form-dialog-shell
      title="Nueva llave"
      size="md"
      [footerBar]="true"
      (close)="cancel()"
    >
      <db-form>
        @if (created) {
          <div class="api-key-secret">
            <p class="api-key-secret__warn">
              Copiala ahora: no se vuelve a mostrar.
            </p>
            <code class="api-key-secret__value">{{ created.secret }}</code>
            @if (copyNotice) {
              <p class="api-key-secret__notice" role="status">
                {{ copyNotice }}
              </p>
            }
          </div>
          <db-form-footer>
            <db-button
              label="Copiar"
              variant="cancel"
              format="soft"
              (clicked)="copySecret()"
            />
            <db-button
              label="Listo"
              variant="primary"
              format="solid"
              (clicked)="dialogRef.close(created)"
            />
          </db-form-footer>
        } @else {
          <form (ngSubmit)="save()" autocomplete="off">
            <db-input
              label="Nombre"
              [(ngModel)]="name"
              name="apiKeyName"
              placeholder="Ej.: Agente WhatsApp"
              [required]="true"
            />
            <db-form-field label="Permisos">
              <db-checkbox-group>
                @for (option of scopeOptions; track option.id) {
                  <db-checkbox
                    [label]="option.label"
                    [name]="'apiKeyScope-' + option.id"
                    [ngModel]="selected.has(option.id)"
                    (ngModelChange)="toggleScope(option.id, $event)"
                  />
                }
              </db-checkbox-group>
            </db-form-field>
            @if (error) {
              <db-form-error>{{ error }}</db-form-error>
            }
            <db-form-footer>
              <db-button
                label="Cancelar"
                variant="cancel"
                format="soft"
                (clicked)="cancel()"
              />
              <db-button
                [label]="loading ? 'Creando...' : 'Crear llave'"
                variant="primary"
                format="solid"
                buttonType="submit"
                [disabled]="loading || !name.trim() || selected.size === 0"
              />
            </db-form-footer>
          </form>
        }
      </db-form>
    </app-form-dialog-shell>
  `,
  styles: `
    @use '../shared/styles/variables' as *;

    .api-key-secret {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .api-key-secret__warn,
    .api-key-secret__notice {
      margin: 0;
      font-size: 0.875rem;
    }

    .api-key-secret__value {
      padding: 0.75rem;
      border-radius: 0.5rem;
      background: $color-surface-subtle;
      font-size: 0.875rem;
      word-break: break-all;
      user-select: all;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApiKeyFormDialogComponent implements OnInit {
  private readonly apiKeysService = inject(ApiKeysService);
  private readonly cdr = inject(ChangeDetectorRef);
  readonly dialogRef = inject(DialogRef<CreatedApiKey | undefined>);
  private readonly data = inject<ApiKeyFormDialogData>(DIALOG_DATA);
  private readonly formDialogs = inject(FormDialogService);
  private readonly destroyRef = inject(DestroyRef);
  private confirmingDiscard = false;

  scopeOptions: ApiKeyScopeOption[] = [];
  name = '';
  readonly selected = new Set<string>();
  created: CreatedApiKey | null = null;
  copyNotice = '';
  loading = false;
  error = '';

  ngOnInit(): void {
    this.scopeOptions = this.data.scopeOptions;
    guardDialogDismiss(this.dialogRef, this.destroyRef, () => this.cancel());
  }

  toggleScope(id: string, checked: boolean): void {
    if (checked) this.selected.add(id);
    else this.selected.delete(id);
  }

  save(): void {
    const name = this.name.trim();
    if (!name || this.selected.size === 0) {
      this.error = 'Poné un nombre y elegí al menos un permiso.';
      this.cdr.markForCheck();
      return;
    }
    this.loading = true;
    this.error = '';
    this.cdr.markForCheck();

    this.apiKeysService
      .create({ name, scopes: [...this.selected] })
      .subscribe({
        next: (created) => {
          this.loading = false;
          this.created = created;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.loading = false;
          this.error = extractApiErrorMessage(err, 'No se pudo crear la llave');
          this.cdr.markForCheck();
        },
      });
  }

  copySecret(): void {
    if (!this.created) return;
    try {
      void navigator.clipboard.writeText(this.created.secret).then(
        () => this.setCopyNotice('Copiada'),
        () => this.setCopyNotice('No se pudo copiar'),
      );
    } catch {
      this.setCopyNotice('No se pudo copiar');
    }
  }

  cancel(): void {
    if (this.created) {
      this.dialogRef.close(this.created);
      return;
    }
    if (this.confirmingDiscard || this.loading) return;
    this.confirmingDiscard = true;
    confirmMobileFormDiscard(this.formDialogs, {
      hasChanges: !!this.name.trim() || this.selected.size > 0,
      entityLabel: 'la llave',
    }).subscribe((confirmed) => {
      this.confirmingDiscard = false;
      if (confirmed) this.dialogRef.close();
    });
  }

  private setCopyNotice(text: string): void {
    this.copyNotice = text;
    this.cdr.markForCheck();
  }
}
