export const REDIS_DEFAULT_HOST = "127.0.0.1";
export const REDIS_DEFAULT_PORT = 6379;
export const REDIS_DEFAULT_DB = 0;
export const TEST_REDIS_DEFAULT_DB = 15;

export type RedisConnectionOptions = {
  db: number;
  host: string;
  port: number;
};

export function resolveRedisConnection(): RedisConnectionOptions {
  return {
    db: parseDb(process.env.REDIS_DB, REDIS_DEFAULT_DB, "REDIS_DB"),
    host: process.env.REDIS_HOST ?? REDIS_DEFAULT_HOST,
    port: parsePort(process.env.REDIS_PORT),
  };
}

export function resolveTestRedisConnection(): RedisConnectionOptions {
  return {
    db: parseDb(
      process.env.TEST_REDIS_DB ?? process.env.REDIS_DB,
      TEST_REDIS_DEFAULT_DB,
      "TEST_REDIS_DB",
    ),
    host: process.env.TEST_REDIS_HOST ?? process.env.REDIS_HOST ?? REDIS_DEFAULT_HOST,
    port: parsePort(process.env.TEST_REDIS_PORT ?? process.env.REDIS_PORT),
  };
}

function parseDb(
  value: string | undefined,
  fallback: number,
  label: string,
): number {
  if (value === undefined) {
    return fallback;
  }

  const db = Number.parseInt(value, 10);

  if (!Number.isInteger(db) || db < 0) {
    throw new Error(`Invalid ${label}: ${value}`);
  }

  return db;
}

function parsePort(value: string | undefined): number {
  if (value === undefined) {
    return REDIS_DEFAULT_PORT;
  }

  const port = Number.parseInt(value, 10);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid REDIS_PORT: ${value}`);
  }

  return port;
}
