import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ChatMessage } from '../models';

/** Estado de la conexión con Meta (§28.1). Los ids salen de las variables de entorno. */
export interface MetaStatus {
  webhookUrl: string;
  verifyTokenConfigured: boolean;
  appSecretConfigured: boolean;
  whatsapp: {
    connected: boolean;
    phoneNumberId: string | null;
    businessAccountId: string | null;
    displayPhoneNumber: string | null;
  };
  instagram: { connected: boolean; accountId: string | null };
  messenger: { connected: boolean; pageId: string | null };
  templates: {
    key: string;
    name: string;
    label: string;
    body: string;
    /** APPROVED, PENDING, REJECTED… null si Meta no la tiene o no respondió. */
    metaStatus: string | null;
  }[];
}

/** A quién va la plantilla: el chat, o el cliente del pedido o presupuesto. */
export interface WhatsAppTemplateTarget {
  conversationId?: string;
  orderId?: string;
  quoteId?: string;
}

export interface WhatsAppTemplatePreview {
  key: string;
  label: string;
  text: string | null;
  error: string | null;
}

@Injectable({ providedIn: 'root' })
export class MetaService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/meta`;

  status(): Observable<MetaStatus> {
    return this.http.get<MetaStatus>(`${this.baseUrl}/status`);
  }

  previewTemplates(
    target: WhatsAppTemplateTarget,
  ): Observable<WhatsAppTemplatePreview[]> {
    return this.http.post<WhatsAppTemplatePreview[]>(
      `${this.baseUrl}/templates/preview`,
      target,
    );
  }

  sendTemplate(
    templateKey: string,
    target: WhatsAppTemplateTarget,
  ): Observable<ChatMessage> {
    return this.http.post<ChatMessage>(`${this.baseUrl}/templates/send`, {
      templateKey,
      ...target,
    });
  }
}
