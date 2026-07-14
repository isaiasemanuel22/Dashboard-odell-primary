import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { App, cert, getApps, initializeApp, ServiceAccount } from 'firebase-admin/app';
import { DecodedIdToken, getAuth } from 'firebase-admin/auth';
import { AppConfigService } from '../config/app-config.service';

@Injectable()
export class FirebaseAdminService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseAdminService.name);
  private app: App | null = null;

  constructor(private readonly config: AppConfigService) {}

  onModuleInit(): void {
    const credentialsPath = this.config.firebaseServiceAccountPath;
    if (!credentialsPath) {
      const message =
        'FIREBASE_SERVICE_ACCOUNT_PATH no configurada. API sin autenticación.';
      if (this.config.requireAuth) {
        throw new Error(message);
      }
      this.logger.warn(message);
      return;
    }

    try {
      const absolutePath = resolve(process.cwd(), credentialsPath);
      const serviceAccount = JSON.parse(
        readFileSync(absolutePath, 'utf8'),
      ) as ServiceAccount;

      this.app =
        getApps()[0] ??
        initializeApp({
          credential: cert(serviceAccount),
        });

      this.logger.log('Firebase Admin inicializado');
    } catch (error) {
      const message = `No se pudo inicializar Firebase Admin: ${this.errorMessage(error)}`;
      if (this.config.requireAuth) {
        throw new Error(message);
      }
      this.logger.error(message);
    }
  }

  isEnabled(): boolean {
    return this.app !== null;
  }

  async verifyIdToken(token: string): Promise<DecodedIdToken> {
    if (!this.app) {
      throw new Error('Firebase Admin no está configurado');
    }
    return getAuth(this.app).verifyIdToken(token);
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
