export interface MysqlConnectionConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  connectionLimit?: number;
  allowPublicKeyRetrieval?: boolean;
  ssl?: boolean | { rejectUnauthorized?: boolean };
}

function isLocalHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function parseBooleanParam(value: string | null): boolean | undefined {
  if (value === null) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;
  return undefined;
}

export function parseMysqlUrl(databaseUrl: string): MysqlConnectionConfig {
  const parsed = new URL(databaseUrl);
  const database = parsed.pathname.replace(/^\//, '');

  if (!database) {
    throw new Error('DATABASE_URL debe incluir el nombre de la base de datos');
  }

  const local = isLocalHost(parsed.hostname);
  const sslParam = parseBooleanParam(parsed.searchParams.get('ssl'));
  const sslMode = parsed.searchParams.get('ssl-mode')?.trim().toUpperCase();
  const useSsl =
    sslParam === true ||
    sslMode === 'REQUIRED' ||
    sslMode === 'VERIFY_CA' ||
    sslMode === 'VERIFY_IDENTITY';

  const allowPublicKeyRetrieval =
    parseBooleanParam(parsed.searchParams.get('allowPublicKeyRetrieval')) ??
    !local;

  const config: MysqlConnectionConfig = {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database,
    connectionLimit: local ? 10 : 5,
    allowPublicKeyRetrieval,
  };

  if (useSsl) {
    config.ssl = { rejectUnauthorized: true };
  }

  return config;
}

export function getDatabaseUrl(): string | undefined {
  return process.env.DATABASE_URL?.trim() || undefined;
}
