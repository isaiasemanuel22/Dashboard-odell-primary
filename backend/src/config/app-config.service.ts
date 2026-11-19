import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppEnv } from './env.validation';

@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<AppEnv, true>) {}

  get nodeEnv(): string {
    return this.config.get('NODE_ENV', { infer: true });
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get port(): number {
    return this.config.get('PORT', { infer: true });
  }

  get databaseUrl(): string | undefined {
    return this.config.get('DATABASE_URL', { infer: true });
  }

  get corsOrigins(): string[] {
    return this.config.get('CORS_ORIGINS', { infer: true });
  }

  get autoSeed(): boolean {
    return this.config.get('AUTO_SEED', { infer: true });
  }

  get firebaseServiceAccountPath(): string | undefined {
    return this.config.get('FIREBASE_SERVICE_ACCOUNT_PATH', { infer: true });
  }

  get firebaseServiceAccountJson(): string | undefined {
    return this.config.get('FIREBASE_SERVICE_ACCOUNT_JSON', { infer: true });
  }

  get firebaseStorageBucket(): string | undefined {
    return this.config.get('FIREBASE_STORAGE_BUCKET', { infer: true });
  }

  get requireDatabase(): boolean {
    return this.config.get('REQUIRE_DATABASE', { infer: true });
  }

  get requireAuth(): boolean {
    return this.config.get('REQUIRE_AUTH', { infer: true });
  }

  get databaseResetCode(): string | undefined {
    return this.config.get('DATABASE_RESET_CODE', { infer: true });
  }

  /** Email que siempre entra como administrador (en minúsculas). */
  get adminEmail(): string | undefined {
    return (
      this.config.get('ADMIN_EMAIL', { infer: true })?.trim().toLowerCase() ||
      undefined
    );
  }

  get resendApiKey(): string | undefined {
    return this.config.get('RESEND_API_KEY', { infer: true });
  }

  get alertsEmailFrom(): string | undefined {
    return this.config.get('ALERTS_EMAIL_FROM', { infer: true });
  }

  get alertsEmailTo(): string | undefined {
    return this.config.get('ALERTS_EMAIL_TO', { infer: true });
  }

  get alertsWhatsAppTo(): string | undefined {
    return this.config.get('ALERTS_WHATSAPP_TO', { infer: true });
  }

  get metaAppSecret(): string | undefined {
    return this.config.get('META_APP_SECRET', { infer: true });
  }

  get metaVerifyToken(): string | undefined {
    return this.config.get('META_VERIFY_TOKEN', { infer: true });
  }

  /** Token de System User para la WhatsApp Cloud API. */
  get metaAccessToken(): string | undefined {
    return this.config.get('META_ACCESS_TOKEN', { infer: true });
  }

  /** Token de la página para la Send API de Instagram y Messenger. */
  get metaPageAccessToken(): string | undefined {
    return this.config.get('META_PAGE_ACCESS_TOKEN', { infer: true });
  }

  get whatsappPhoneNumberId(): string | undefined {
    return this.config.get('WHATSAPP_PHONE_NUMBER_ID', { infer: true });
  }

  get whatsappBusinessAccountId(): string | undefined {
    return this.config.get('WHATSAPP_BUSINESS_ACCOUNT_ID', { infer: true });
  }

  get metaPageId(): string | undefined {
    return this.config.get('META_PAGE_ID', { infer: true });
  }

  get instagramAccountId(): string | undefined {
    return this.config.get('INSTAGRAM_ACCOUNT_ID', { infer: true });
  }

  get whatsappConfigured(): boolean {
    return !!this.metaAccessToken && !!this.whatsappPhoneNumberId;
  }

  get pageConfigured(): boolean {
    return !!this.metaPageAccessToken && !!this.metaPageId;
  }
}
