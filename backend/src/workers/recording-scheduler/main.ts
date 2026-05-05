import { spawn } from "node:child_process";

import { Pool } from "pg";
import { v7 as uuidv7 } from "uuid";

import { createDatabaseFromPool } from "../../db/database.js";
import { JobRepository } from "../../db/job-repository.js";
import {
  createPgBoss,
  ensureQueue,
  PgBossJobQueue,
} from "../../job-queue/pg-boss.js";
import type { RecordingSchedulerJobPayload } from "../../job-queue/types.js";
import {
  RECORD_CONTENT_JOB_NAME,
  RECORDING_SCHEDULER_JOB_NAME,
} from "../../job-queue/types.js";
import { createLogger } from "../../logger/index.js";
import { getRuntimeConfig } from "../../runtime-config.js";
import { handleRecordingSchedulerJob } from "./handle.js";

const RECORD_CONTENT_EXPIRE_IN_SECONDS = 12 * 60 * 60;
const RECORD_CONTENT_HEARTBEAT_SECONDS = 60;

const runtimeConfig = getRuntimeConfig();
const logger = createLogger({
  process: "worker",
  worker: RECORDING_SCHEDULER_JOB_NAME,
});
const pool = new Pool({
  database: runtimeConfig.pgDatabase,
  host: runtimeConfig.pgHost,
  password: runtimeConfig.pgPassword,
  port: runtimeConfig.pgPort,
  user: runtimeConfig.pgUser,
});
const database = createDatabaseFromPool(pool);
const boss = createPgBoss(runtimeConfig);
const jobRepository = new JobRepository(database);
const jobQueue = new PgBossJobQueue(boss);

boss.on("error", (error) => {
  logger.error("job queue runtime failed.", { error });
});

await boss.start();
await ensureQueue(boss, RECORDING_SCHEDULER_JOB_NAME, {
  retryBackoff: true,
  retryDelay: 5,
  retryLimit: 2,
});
await ensureQueue(boss, RECORD_CONTENT_JOB_NAME, {
  expireInSeconds: RECORD_CONTENT_EXPIRE_IN_SECONDS,
  heartbeatSeconds: RECORD_CONTENT_HEARTBEAT_SECONDS,
});

await seedRecordingSchedulerJob(jobRepository, jobQueue);

await boss.work<RecordingSchedulerJobPayload>(
  RECORDING_SCHEDULER_JOB_NAME,
  async ([job]) => {
    const result = await handleRecordingSchedulerJob(job.data, {
      jobQueue,
      jobRepository,
      logger,
      startRecordContentWorker: spawnRecordContentWorker,
    });

    if (!result.ok) {
      throw result.error;
    }
  },
);

logger.info("worker started.", {
  queueName: RECORDING_SCHEDULER_JOB_NAME,
});

async function seedRecordingSchedulerJob(
  currentJobRepository: JobRepository,
  currentJobQueue: PgBossJobQueue,
): Promise<void> {
  const existingJob = await currentJobRepository.findQueuedOrRunningJobByKind(
    RECORDING_SCHEDULER_JOB_NAME,
  );

  if (existingJob !== null) {
    return;
  }

  const job = await currentJobRepository.createJob({
    id: uuidv7(),
    kind: RECORDING_SCHEDULER_JOB_NAME,
    retryable: true,
    sourceId: null,
  });

  if (!job.ok) {
    throw job.error;
  }

  const queueJobId = await currentJobQueue.enqueue(
    RECORDING_SCHEDULER_JOB_NAME,
    {
      jobId: job.value.id,
    },
  );

  const attachQueueJobIdResult = await currentJobRepository.attachQueueJobId(
    job.value.id,
    queueJobId,
  );

  if (!attachQueueJobIdResult.ok) {
    throw attachQueueJobIdResult.error;
  }
}

async function spawnRecordContentWorker(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", "backend/src/workers/record-content/main.ts"],
      {
        cwd: process.cwd(),
        detached: true,
        stdio: "ignore",
      },
    );

    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}
