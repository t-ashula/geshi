import { Pool } from "pg";
import { v7 as uuidv7 } from "uuid";

import { JobRepository } from "../../db/job-repository.js";
import { PluginGlobalRuntimeStateRepository } from "../../db/plugin-global-runtime-state-repository.js";
import { createDatabaseFromPool } from "../../db/database.js";
import { SourceDetectionRepository } from "../../db/source-detection-repository.js";
import {
  createPgBoss,
  ensureQueue,
  PgBossJobQueue,
} from "../../job-queue/pg-boss.js";
import type { PeriodicSourceDetectionJobPayload } from "../../job-queue/types.js";
import { PERIODIC_SOURCE_DETECTION_JOB_NAME } from "../../job-queue/types.js";
import { createLogger } from "../../logger/index.js";
import { getRuntimeConfig } from "../../runtime-config.js";
import { createSourceDetectionService } from "../../service/source-detection-service.js";
import { handlePeriodicSourceDetectionJob } from "./handle.js";

const runtimeConfig = getRuntimeConfig();
const logger = createLogger({
  process: "worker",
  worker: PERIODIC_SOURCE_DETECTION_JOB_NAME,
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
const pluginGlobalRuntimeStateRepository =
  new PluginGlobalRuntimeStateRepository(database);
const sourceDetectionRepository = new SourceDetectionRepository(database);
const sourceDetectionService = createSourceDetectionService(
  sourceDetectionRepository,
  {
    logger: logger.child({
      service: "source-detection",
    }),
    pluginGlobalRuntimeStateRepository,
  },
);
const jobQueue = new PgBossJobQueue(boss);

boss.on("error", (error) => {
  logger.error("job queue runtime failed.", { error });
});

await boss.start();
await ensureQueue(boss, PERIODIC_SOURCE_DETECTION_JOB_NAME, {
  retryBackoff: true,
  retryDelay: 5,
  retryLimit: 2,
});

await seedPeriodicSourceDetectionJob(jobRepository, jobQueue);

await boss.work<PeriodicSourceDetectionJobPayload>(
  PERIODIC_SOURCE_DETECTION_JOB_NAME,
  async ([job]) => {
    const result = await handlePeriodicSourceDetectionJob(job.data, {
      jobQueue,
      jobRepository,
      logger,
      sourceDetectionService,
    });

    if (!result.ok) {
      throw result.error;
    }
  },
);

logger.info("worker started.", {
  queueName: PERIODIC_SOURCE_DETECTION_JOB_NAME,
});

async function seedPeriodicSourceDetectionJob(
  currentJobRepository: JobRepository,
  currentJobQueue: PgBossJobQueue,
): Promise<void> {
  const existingJob = await currentJobRepository.findIncompleteJobByKind(
    PERIODIC_SOURCE_DETECTION_JOB_NAME,
  );

  if (existingJob !== null) {
    return;
  }

  const jobId = uuidv7();
  const queuePayload = { jobId };
  const createJobResult = await currentJobRepository.createJob({
    id: jobId,
    kind: PERIODIC_SOURCE_DETECTION_JOB_NAME,
    payload: queuePayload,
    retryable: true,
  });

  if (!createJobResult.ok) {
    throw createJobResult.error;
  }

  const queueJobId = await currentJobQueue.enqueue(
    PERIODIC_SOURCE_DETECTION_JOB_NAME,
    queuePayload,
  );
  const attachQueueJobIdResult =
    await currentJobRepository.attachQueueJobId(
      createJobResult.value.id,
      queueJobId,
    );

  if (!attachQueueJobIdResult.ok) {
    throw attachQueueJobIdResult.error;
  }
}
