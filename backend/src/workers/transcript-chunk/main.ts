import { Pool } from "pg";

import { createDatabaseFromPool } from "../../db/database.js";
import { JobRepository } from "../../db/job-repository.js";
import { TranscriptRepository } from "../../db/transcript-repository.js";
import { createScribeClient } from "../../integrations/scribe-client.js";
import { createPgBoss, ensureQueue } from "../../job-queue/pg-boss.js";
import type { TranscriptChunkJobPayload } from "../../job-queue/types.js";
import { TRANSCRIPT_CHUNK_JOB_NAME } from "../../job-queue/types.js";
import { createLogger } from "../../logger/index.js";
import { getRuntimeConfig } from "../../runtime-config.js";
import { FilesystemStorage } from "../../storage/filesystem-storage.js";
import { handleTranscriptChunkJob } from "./handle.js";

const runtimeConfig = getRuntimeConfig();
const logger = createLogger({
  process: "worker",
  worker: TRANSCRIPT_CHUNK_JOB_NAME,
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
const scribeClient = createScribeClient(runtimeConfig.scribeBaseUrl);
const transcriptRepository = new TranscriptRepository(database);
const workStorage = new FilesystemStorage(runtimeConfig.workStorageRootDir);

boss.on("error", (error) => {
  logger.error("job queue runtime failed.", { error });
});

await boss.start();
await ensureQueue(boss, TRANSCRIPT_CHUNK_JOB_NAME, {
  retryBackoff: true,
  retryDelay: 5,
  retryLimit: 2,
});

await boss.work<TranscriptChunkJobPayload>(
  TRANSCRIPT_CHUNK_JOB_NAME,
  async ([job]) => {
    const result = await handleTranscriptChunkJob(job.data, {
      jobRepository,
      logger,
      scribeClient,
      transcriptRepository,
      workStorage,
    });

    if (!result.ok) {
      throw result.error;
    }
  },
);

logger.info("worker started.", {
  queueName: TRANSCRIPT_CHUNK_JOB_NAME,
});
