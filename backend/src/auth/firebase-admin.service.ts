import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { getStorage } from 'firebase-admin/storage';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { App, cert, getApps, initializeApp, ServiceAccount } from 'firebase-admin/app';
import { DecodedIdToken, getAuth } from 'firebase-admin/auth';
import { AppConfigService } from '../config/app-config.service';

@Injectable()
export class FirebaseAdminService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseAdminService.name);
  private app: App | null = null;
  private storageBucket: string | null = null;

  constructor(private readonly config: AppConfigService) {
    this.initialize();
  }

  private initialize(): void {
    const credentialsPath = this.config.firebaseServiceAccountPath;
    const credentialsJson = this.config.firebaseServiceAccountJson;

    if (!credentialsPath && !credentialsJson) {
      const message =
        'Firebase Admin sin credenciales (PATH o JSON). API sin autenticación.';
      if (this.config.requireAuth) {
        throw new Error(message);
      }
      this.logger.warn(message);
      return;
    }

    try {
      const serviceAccount = this.loadServiceAccount(
        credentialsJson,
        credentialsPath,
      );

      const projectId = serviceAccount.projectId;
      this.storageBucket =
        this.config.firebaseStorageBucket ??
        (projectId ? `${projectId}.firebasestorage.app` : null);

      this.app =
        getApps()[0] ??
        initializeApp({
          credential: cert(serviceAccount),
          storageBucket: this.storageBucket ?? undefined,
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

  async onModuleInit(): Promise<void> {
    await this.verifyStorageBucket();
  }

  isEnabled(): boolean {
    return this.app !== null;
  }

  getStorageBucket(): string | null {
    return this.storageBucket;
  }

  async verifyIdToken(token: string): Promise<DecodedIdToken> {
    if (!this.app) {
      throw new Error('Firebase Admin no está configurado');
    }
    return getAuth(this.app).verifyIdToken(token);
  }

  private loadServiceAccount(
    credentialsJson: string | undefined,
    credentialsPath: string | undefined,
  ): ServiceAccount {
    if (credentialsJson) {
      return JSON.parse(credentialsJson) as ServiceAccount;
    }

    const absolutePath = resolve(process.cwd(), credentialsPath!);
    return JSON.parse(readFileSync(absolutePath, 'utf8')) as ServiceAccount;
  }

  private async verifyStorageBucket(): Promise<void> {
    if (!this.app || !this.storageBucket) return;

    try {
      const [exists] = await getStorage(this.app).bucket(this.storageBucket).exists();
      if (exists) {
        this.logger.log(`Firebase Storage bucket OK: ${this.storageBucket}`);
        return;
      }

      this.logger.error(
        `Firebase Storage bucket "${this.storageBucket}" no existe. ` +
          'En Firebase Console → Storage → "Comenzar" (requiere plan Blaze). ' +
          'Luego copiá el nombre exacto del bucket a FIREBASE_STORAGE_BUCKET.',
      );
    } catch (error) {
      this.logger.error(
        `No se pudo verificar Firebase Storage (${this.storageBucket}): ${this.errorMessage(error)}`,
      );
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
