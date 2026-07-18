export interface AppEnv {
  NODE_ENV: string;
  PORT: number;
  DATABASE_URL?: string;
  CORS_ORIGINS: string[];
  AUTO_SEED: boolean;
  FIREBASE_SERVICE_ACCOUNT_PATH?: string;
  FIREBASE_STORAGE_BUCKET?: string;
  PRODUCT_IMAGE_STORAGE: 'backend' | 'firebase';
  REQUIRE_DATABASE: boolean;
  REQUIRE_AUTH: boolean;
}

export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const nodeEnv = String(config.NODE_ENV ?? 'development');
  const isProd = nodeEnv === 'production';
  const databaseUrl = optionalString(config.DATABASE_URL);
  const firebasePath = optionalString(config.FIREBASE_SERVICE_ACCOUNT_PATH);

  if (isProd && !databaseUrl) {
    throw new Error('DATABASE_URL es obligatoria en producción');
  }

  if (isProd && !firebasePath) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_PATH es obligatoria en producción',
    );
  }

  const corsRaw = optionalString(config.CORS_ORIGINS);
  const corsOrigins = corsRaw
    ? corsRaw.split(',').map((origin) => origin.trim()).filter(Boolean)
    : ['http://localhost:4200'];

  const port = Number(config.PORT ?? 3000);
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error('PORT debe ser un número positivo');
  }

  const productImageStorage =
    String(config.PRODUCT_IMAGE_STORAGE ?? '').trim().toLowerCase() === 'firebase'
      ? 'firebase'
      : 'backend';

  return {
    NODE_ENV: nodeEnv,
    PORT: port,
    DATABASE_URL: databaseUrl,
    CORS_ORIGINS: corsOrigins,
    AUTO_SEED: parseBoolean(config.AUTO_SEED, false),
    FIREBASE_SERVICE_ACCOUNT_PATH: firebasePath,
    FIREBASE_STORAGE_BUCKET: optionalString(config.FIREBASE_STORAGE_BUCKET),
    PRODUCT_IMAGE_STORAGE: productImageStorage,
    REQUIRE_DATABASE: parseBoolean(config.REQUIRE_DATABASE, isProd),
    REQUIRE_AUTH: parseBoolean(config.REQUIRE_AUTH, isProd),
  };
}

function optionalString(value: unknown): string | undefined {
  const trimmed = String(value ?? '').trim();
  return trimmed || undefined;
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
}
