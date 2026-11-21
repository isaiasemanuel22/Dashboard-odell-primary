export interface AppEnv {
  NODE_ENV: string;
  PORT: number;
  DATABASE_URL?: string;
  CORS_ORIGINS: string[];
  AUTO_SEED: boolean;
  FIREBASE_SERVICE_ACCOUNT_PATH?: string;
  /** JSON minificado de la cuenta de servicio (Heroku / PaaS). */
  FIREBASE_SERVICE_ACCOUNT_JSON?: string;
  FIREBASE_STORAGE_BUCKET?: string;
  REQUIRE_DATABASE: boolean;
  REQUIRE_AUTH: boolean;
  /** Código para POST /settings/reset-database. Si falta, el reseteo queda deshabilitado. */
  DATABASE_RESET_CODE?: string;
  ADMIN_EMAIL?: string;
  /** Avisos automáticos (§28.5): email por Resend y destinatarios. */
  RESEND_API_KEY?: string;
  ALERTS_EMAIL_FROM?: string;
  ALERTS_EMAIL_TO?: string;
  ALERTS_WHATSAPP_TO?: string;
  /** Conexión con Meta (§28.1): WhatsApp Cloud API, Instagram y Messenger. */
  META_APP_SECRET?: string;
  META_VERIFY_TOKEN?: string;
  META_ACCESS_TOKEN?: string;
  META_PAGE_ACCESS_TOKEN?: string;
  WHATSAPP_PHONE_NUMBER_ID?: string;
  WHATSAPP_BUSINESS_ACCOUNT_ID?: string;
  META_PAGE_ID?: string;
  INSTAGRAM_ACCOUNT_ID?: string;
  /** Agente de atención (§28.3): API de Claude. */
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
}

export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-base-to-string -- variables de entorno: se acepta cualquier valor y se convierte a texto
  const nodeEnv = String(config.NODE_ENV ?? 'development');
  const isProd = nodeEnv === 'production';
  const databaseUrl = optionalString(config.DATABASE_URL);
  const firebasePath = optionalString(config.FIREBASE_SERVICE_ACCOUNT_PATH);
  const firebaseJson = optionalString(config.FIREBASE_SERVICE_ACCOUNT_JSON);

  if (isProd && !databaseUrl) {
    throw new Error('DATABASE_URL es obligatoria en producción');
  }

  if (isProd && !firebasePath && !firebaseJson) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_PATH o FIREBASE_SERVICE_ACCOUNT_JSON es obligatoria en producción',
    );
  }

  const corsRaw = optionalString(config.CORS_ORIGINS);
  const corsOrigins = corsRaw
    ? corsRaw
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    : ['http://localhost:4200'];

  const port = Number(config.PORT ?? 3000);
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error('PORT debe ser un número positivo');
  }

  return {
    NODE_ENV: nodeEnv,
    PORT: port,
    DATABASE_URL: databaseUrl,
    CORS_ORIGINS: corsOrigins,
    AUTO_SEED: parseBoolean(config.AUTO_SEED, false),
    FIREBASE_SERVICE_ACCOUNT_PATH: firebasePath,
    FIREBASE_SERVICE_ACCOUNT_JSON: firebaseJson,
    FIREBASE_STORAGE_BUCKET: optionalString(config.FIREBASE_STORAGE_BUCKET),
    REQUIRE_DATABASE: parseBoolean(config.REQUIRE_DATABASE, isProd),
    REQUIRE_AUTH: parseBoolean(config.REQUIRE_AUTH, isProd),
    DATABASE_RESET_CODE: optionalString(config.DATABASE_RESET_CODE),
    ADMIN_EMAIL: optionalString(config.ADMIN_EMAIL),
    RESEND_API_KEY: optionalString(config.RESEND_API_KEY),
    ALERTS_EMAIL_FROM: optionalString(config.ALERTS_EMAIL_FROM),
    ALERTS_EMAIL_TO: optionalString(config.ALERTS_EMAIL_TO),
    ALERTS_WHATSAPP_TO: optionalString(config.ALERTS_WHATSAPP_TO),
    META_APP_SECRET: optionalString(config.META_APP_SECRET),
    META_VERIFY_TOKEN: optionalString(config.META_VERIFY_TOKEN),
    META_ACCESS_TOKEN: optionalString(config.META_ACCESS_TOKEN),
    META_PAGE_ACCESS_TOKEN: optionalString(config.META_PAGE_ACCESS_TOKEN),
    WHATSAPP_PHONE_NUMBER_ID: optionalString(config.WHATSAPP_PHONE_NUMBER_ID),
    WHATSAPP_BUSINESS_ACCOUNT_ID: optionalString(
      config.WHATSAPP_BUSINESS_ACCOUNT_ID,
    ),
    META_PAGE_ID: optionalString(config.META_PAGE_ID),
    INSTAGRAM_ACCOUNT_ID: optionalString(config.INSTAGRAM_ACCOUNT_ID),
    ANTHROPIC_API_KEY: optionalString(config.ANTHROPIC_API_KEY),
    ANTHROPIC_MODEL: optionalString(config.ANTHROPIC_MODEL),
  };
}

function optionalString(value: unknown): string | undefined {
  // eslint-disable-next-line @typescript-eslint/no-base-to-string -- variables de entorno: se acepta cualquier valor y se convierte a texto
  const trimmed = String(value ?? '').trim();
  return trimmed || undefined;
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null || value === '') return fallback;
  // eslint-disable-next-line @typescript-eslint/no-base-to-string -- variables de entorno: se acepta cualquier valor y se convierte a texto
  return String(value).toLowerCase() === 'true';
}
