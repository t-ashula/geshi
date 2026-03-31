export const REDIS_DEFAULT_HOST = "127.0.0.1";
export const REDIS_DEFAULT_PORT = 6379;

export type RedisConnectionOptions = {
  host: string;
  port: number;
};

export function resolveRedisConnection(): RedisConnectionOptions {
  return {
    host: process.env.REDIS_HOST ?? REDIS_DEFAULT_HOST,
    port: parsePort(process.env.REDIS_PORT),
  };
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
