export type NodeEnv = 'development' | 'staging' | 'production';

export interface AppConfig {
  nodeEnv: NodeEnv;
  port: number;
  databaseUrl: string;
  redisUrl: string;
  minio: {
    endpoint: string;
    port: number;
    accessKey: string;
    secretKey: string;
    bucket: string;
    useSsl: boolean;
  };
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessExpiresIn: string;
    refreshExpiresIn: string;
  };
}

function requireEnv(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function parseNodeEnv(value: string | undefined): NodeEnv {
  if (value === 'staging' || value === 'production') {
    return value;
  }
  return 'development';
}

export function loadAppConfig(): AppConfig {
  const nodeEnv = parseNodeEnv(process.env['NODE_ENV']);

  return {
    nodeEnv,
    port: Number(process.env['PORT'] ?? 3000),
    databaseUrl: requireEnv(
      'DATABASE_URL',
      'postgresql://anc:anc@localhost:5432/anc_suite?schema=public',
    ),
    redisUrl: requireEnv('REDIS_URL', 'redis://localhost:6379'),
    minio: {
      endpoint: requireEnv('MINIO_ENDPOINT', 'localhost'),
      port: Number(process.env['MINIO_PORT'] ?? 9000),
      accessKey: requireEnv('MINIO_ACCESS_KEY', 'minioadmin'),
      secretKey: requireEnv('MINIO_SECRET_KEY', 'minioadmin'),
      bucket: requireEnv('MINIO_BUCKET', 'anc-suite'),
      useSsl: process.env['MINIO_USE_SSL'] === 'true',
    },
    jwt: {
      accessSecret: requireEnv(
        'JWT_ACCESS_SECRET',
        nodeEnv === 'production' ? undefined : 'dev-access-secret-change-me',
      ),
      refreshSecret: requireEnv(
        'JWT_REFRESH_SECRET',
        nodeEnv === 'production' ? undefined : 'dev-refresh-secret-change-me',
      ),
      accessExpiresIn: process.env['JWT_ACCESS_EXPIRES_IN'] ?? '15m',
      refreshExpiresIn: process.env['JWT_REFRESH_EXPIRES_IN'] ?? '7d',
    },
  };
}
