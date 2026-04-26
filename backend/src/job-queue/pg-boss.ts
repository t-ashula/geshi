import type { QueueOptions } from "pg-boss";
import { PgBoss } from "pg-boss";

import type { getRuntimeConfig } from "../runtime-config.js";
import type { JobPayload, JobQueue } from "./types.js";

type RuntimeConfig = ReturnType<typeof getRuntimeConfig>;

export function createPgBoss(runtimeConfig: RuntimeConfig): PgBoss {
  return new PgBoss({
    database: runtimeConfig.pgDatabase,
    host: runtimeConfig.pgHost,
    password: runtimeConfig.pgPassword,
    port: runtimeConfig.pgPort,
    schema: "pgboss",
    user: runtimeConfig.pgUser,
  });
}

export class PgBossJobQueue implements JobQueue {
  public constructor(private readonly boss: PgBoss) {}

  public async enqueue(
    name: string,
    payload: JobPayload,
  ): Promise<string | null> {
    return this.boss.send(name, payload, {
      retryBackoff: true,
      retryDelay: 5,
      retryLimit: 2,
    });
  }
}

export async function ensureQueue(
  boss: PgBoss,
  name: string,
  options?: QueueOptions,
): Promise<void> {
  try {
    await boss.createQueue(name, options);
  } catch (error) {
    if (error instanceof Error && error.message.includes("already exists")) {
      return;
    }

    throw error;
  }
}
