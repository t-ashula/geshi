import { randomUUID } from "node:crypto";
import { appendFileSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";

import { Queue, Worker } from "bullmq";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { resolveTestRedisConnection } from "../../../src/bullmq/index.js";
import {
  createExportJobWorker,
  createHealthCheckWorker,
  createImportJobWorker,
  createJobApi,
  createJobRuntime,
  createJobStore,
  createNoopImportInstructionHandler,
  createUpdateJobWorker,
  wrapFunctionalJobWorker,
} from "../../../src/job/index.js";
import {
  EXPORT_JOB_QUEUE_NAME,
  IMPORT_JOB_QUEUE_NAME,
  UPDATE_JOB_QUEUE_NAME,
} from "../../../src/job/runtime/bullmq/index.js";
import type { Logger } from "../../../src/logger/index.js";

const DEFAULT_TEST_DATABASE_URL = "postgres://geshi:geshi@127.0.0.1:5432/geshi";
const SCHEMA_SQL_PATH = new URL("../../../db/schema.sql", import.meta.url);
const HEALTH_CHECK_QUEUE_NAME = "job-health-check";

describe("HealthCheck job flow (mid)", () => {
  const testRunId = randomUUID();
  const schemaName = `mid_${testRunId.replaceAll("-", "_")}`;
  const logFilePath = `/tmp/geshi-health-check-flow-${testRunId}.log`;
  const baseDatabaseUrl =
    process.env.TEST_DATABASE_URL ??
    process.env.DATABASE_URL ??
    DEFAULT_TEST_DATABASE_URL;
  const redisConnection = resolveTestRedisConnection();

  let adminPool: Pool | null = null;
  let storePool: Pool | null = null;
  let exportQueue: Queue<{ jobId: string }> | null = null;
  let updateQueue: Queue<unknown> | null = null;
  let importQueue: Queue<unknown> | null = null;
  let healthCheckQueue: Queue<unknown> | null = null;
  let exportWorker: Worker<{ jobId: string }> | null = null;
  let updateWorker: Worker | null = null;
  let importWorker: Worker | null = null;
  let healthCheckWorker: Worker | null = null;

  beforeAll(async () => {
    process.stdout.write(`HealthCheck flow log file: ${logFilePath}\n`);

    adminPool = new Pool({
      connectionString: baseDatabaseUrl,
    });

    await adminPool.query(`create schema "${schemaName}"`);

    storePool = new Pool({
      connectionString: baseDatabaseUrl,
      options: `-c search_path=${schemaName}`,
    });

    const schemaSql = await readFile(SCHEMA_SQL_PATH, "utf8");
    await storePool.query(schemaSql);

    exportQueue = new Queue(EXPORT_JOB_QUEUE_NAME, {
      connection: redisConnection,
    });
    updateQueue = new Queue(UPDATE_JOB_QUEUE_NAME, {
      connection: redisConnection,
    });
    importQueue = new Queue(IMPORT_JOB_QUEUE_NAME, {
      connection: redisConnection,
    });
    healthCheckQueue = new Queue(HEALTH_CHECK_QUEUE_NAME, {
      connection: redisConnection,
    });

    await exportQueue.obliterate({ force: true });
    await updateQueue.obliterate({ force: true });
    await importQueue.obliterate({ force: true });
    await healthCheckQueue.obliterate({ force: true });

    const store = createJobStore({
      kind: "pg",
      options: {
        databaseUrl: baseDatabaseUrl,
        searchPath: schemaName,
      },
    });
    const runtime = createJobRuntime({
      kind: "bullmq",
      options: {
        connection: redisConnection,
      },
    });
    const api = createJobApi(store, runtime);

    exportWorker = createExportJobWorker(
      api,
      healthCheckQueue,
      redisConnection,
    );
    updateWorker = createUpdateJobWorker(api, redisConnection);
    importWorker = createImportJobWorker(
      api,
      createNoopImportInstructionHandler(),
      redisConnection,
    );
    const logger = createFileLogger(logFilePath);
    healthCheckWorker = new Worker(
      HEALTH_CHECK_QUEUE_NAME,
      wrapFunctionalJobWorker(createHealthCheckWorker({ logger }), runtime),
      {
        connection: redisConnection,
      },
    );

    await Promise.all([
      exportWorker.waitUntilReady(),
      updateWorker.waitUntilReady(),
      importWorker.waitUntilReady(),
      healthCheckWorker.waitUntilReady(),
    ]);
  });

  beforeEach(async () => {
    writeFileSync(logFilePath, "");
    await storePool!.query("truncate table job_events, jobs cascade");
    await exportQueue!.drain(true);
    await updateQueue!.drain(true);
    await importQueue!.drain(true);
    await healthCheckQueue!.drain(true);
  });

  afterAll(async () => {
    await Promise.all([
      exportWorker?.close(),
      updateWorker?.close(),
      importWorker?.close(),
      healthCheckWorker?.close(),
    ]);

    await Promise.all([
      exportQueue?.obliterate({ force: true }),
      updateQueue?.obliterate({ force: true }),
      importQueue?.obliterate({ force: true }),
      healthCheckQueue?.obliterate({ force: true }),
    ]);

    await Promise.all([
      exportQueue?.close(),
      updateQueue?.close(),
      importQueue?.close(),
      healthCheckQueue?.close(),
    ]);

    if (storePool !== null) {
      await storePool.end();
    }

    if (adminPool !== null) {
      await adminPool.query(`drop schema if exists "${schemaName}" cascade`);
      await adminPool.end();
    }
  });

  it("runs HealthCheck job from createJob through succeeded", async () => {
    const store = createJobStore({
      kind: "pg",
      options: {
        databaseUrl: baseDatabaseUrl,
        searchPath: schemaName,
      },
    });
    const runtime = createJobRuntime({
      kind: "bullmq",
      options: {
        connection: redisConnection,
      },
    });
    const api = createJobApi(store, runtime);

    const job = await api.createJob({
      kind: "healthCheck",
      payload: {
        testRunId,
      },
    });

    const terminalJob = await waitFor(async () => {
      const current = await store.getJob(job.id);

      if (current?.status === "succeeded") {
        return current;
      }

      return null;
    });

    expect(terminalJob).not.toBeNull();
    expect(terminalJob?.status).toBe("succeeded");
    expect(terminalJob?.note).toBe("HealthCheck completed");

    const events = await storePool!.query<{
      status: string;
      runtime_job_id: string | null;
      note: string | null;
    }>(
      `
        select status, runtime_job_id, note
        from job_events
        where job_id = $1
        order by occurred_at asc, id asc
      `,
      [job.id],
    );

    expect(events.rows.map((row) => row.status)).toEqual([
      "registered",
      "queued",
      "running",
      "importing",
      "succeeded",
    ]);
    expect(events.rows[1]?.runtime_job_id).toBeTruthy();
    expect(events.rows[4]?.note).toBe("HealthCheck completed");

    const logFile = await readFile(logFilePath, "utf8");

    expect(logFile).toContain("\"msg\":\"HealthCheck worker reached.\"");
    expect(logFile).toContain(`"testRunId":"${testRunId}"`);
  });
});

function createFileLogger(
  logFilePath: string,
  bindings: Record<string, unknown> = {},
): Logger {
  return {
    debug(message, metadata) {
      writeLogLine(logFilePath, "debug", message, bindings, metadata);
    },
    info(message, metadata) {
      writeLogLine(logFilePath, "info", message, bindings, metadata);
    },
    warn(message, metadata) {
      writeLogLine(logFilePath, "warn", message, bindings, metadata);
    },
    error(message, metadata) {
      writeLogLine(logFilePath, "error", message, bindings, metadata);
    },
    child(childBindings) {
      return createFileLogger(logFilePath, {
        ...bindings,
        ...childBindings,
      });
    },
  };
}

async function waitFor<T>(
  fn: () => Promise<T | null>,
  timeoutMs = 5_000,
  intervalMs = 50,
): Promise<T | null> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const value = await fn();

    if (value !== null) {
      return value;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, intervalMs);
    });
  }

  return null;
}

function writeLogLine(
  logFilePath: string,
  level: "debug" | "info" | "warn" | "error",
  message: string,
  bindings: Record<string, unknown>,
  metadata?: Record<string, unknown>,
): void {
  appendFileSync(
    logFilePath,
    `${JSON.stringify({
      ...bindings,
      ...(metadata ?? {}),
      level,
      msg: message,
      time: new Date().toISOString(),
    })}\n`,
  );
}
