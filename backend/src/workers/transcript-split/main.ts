import { Pool } from "pg";

import { createDatabaseFromPool } from "../../db/database.js";
import { JobRepository } from "../../db/job-repository.js";
import { TranscriptRepository } from "../../db/transcript-repository.js";
import {
  createPgBoss,
  ensureQueue,
  PgBossJobQueue,
} from "../../job-queue/pg-boss.js";
import type { TranscriptSplitJobPayload } from "../../job-queue/types.js";
import {
  TRANSCRIPT_CHUNK_JOB_NAME,
  TRANSCRIPT_SPLIT_JOB_NAME,
} from "../../job-queue/types.js";
import { createLogger } from "../../logger/index.js";
import { getRuntimeConfig } from "../../runtime-config.js";
import { FilesystemStorage } from "../../storage/filesystem-storage.js";
import { handleTranscriptSplitJob } from "./handle.js";

const runtimeConfig = getRuntimeConfig();
const logger = createLogger({
  process: "worker",
  worker: TRANSCRIPT_SPLIT_JOB_NAME,
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
const jobQueue = new PgBossJobQueue(boss);
const jobRepository = new JobRepository(database);
const transcriptRepository = new TranscriptRepository(database);
const storage = new FilesystemStorage(runtimeConfig.storageRootDir);
const workStorage = new FilesystemStorage(runtimeConfig.workStorageRootDir);

boss.on("error", (error) => {
  logger.error("job queue runtime failed.", { error });
});

await boss.start();
await ensureQueue(boss, TRANSCRIPT_SPLIT_JOB_NAME, {
  retryBackoff: true,
  retryDelay: 5,
  retryLimit: 2,
});
await ensureQueue(boss, TRANSCRIPT_CHUNK_JOB_NAME, {
  retryBackoff: true,
  retryDelay: 5,
  retryLimit: 2,
});

await boss.work<TranscriptSplitJobPayload>(
  TRANSCRIPT_SPLIT_JOB_NAME,
  async ([job]) => {
    const result = await handleTranscriptSplitJob(job.data, {
      jobQueue,
      jobRepository,
      logger,
      storage,
      transcriptRepository,
      workStorage,
    });

    if (!result.ok) {
      throw result.error;
    }
  },
);

logger.info("worker started.", {
  queueName: TRANSCRIPT_SPLIT_JOB_NAME,
});
