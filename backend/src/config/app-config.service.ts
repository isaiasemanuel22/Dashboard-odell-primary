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
}
