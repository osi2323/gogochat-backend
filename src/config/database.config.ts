import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  host: process.env.POSTGRES_HOST ?? 'localhost',
  port: Number.parseInt(process.env.POSTGRES_PORT ?? '5432', 10),
  username: process.env.POSTGRES_USER ?? 'postgres',
  password: process.env.POSTGRES_PASSWORD ?? 'postgres',
  name: process.env.POSTGRES_DB ?? 'postgres',
  schema: process.env.POSTGRES_SCHEMA ?? 'tenant_master',
  synchronize:
    (process.env.POSTGRES_SYNCHRONIZE ?? 'true').toLowerCase() === 'true',
  ssl: (process.env.POSTGRES_SSL ?? 'false').toLowerCase() === 'true',
  extra: {
    max: Number.parseInt(process.env.POSTGRES_POOL_MAX ?? '10', 10),
    idleTimeoutMillis: Number.parseInt(
      process.env.POSTGRES_IDLE_TIMEOUT_MS ?? '30000',
      10,
    ),
    connectionTimeoutMillis: Number.parseInt(
      process.env.POSTGRES_CONNECTION_TIMEOUT_MS ?? '5000',
      10,
    ),
  },
}));
