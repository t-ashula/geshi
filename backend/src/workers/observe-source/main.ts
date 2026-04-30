import { Pool } from "pg";

import { AssetRepository } from "../../db/asset-repository.js";
import { ContentRepository } from "../../db/content-repository.js";
import { createDatabaseFromPool } from "../../db/database.js";
import { JobRepository } from "../../db/job-repository.js";
import {
  createPgBoss,
  ensureQueue,
  PgBossJobQueue,
} from "../../job-queue/pg-boss.js";
import type { ObserveSourceJobPayload } from "../../job-queue/types.js";
import {
  ACQUIRE_CONTENT_JOB_NAME,
  OBSERVE_SOURCE_JOB_NAME,
} from "../../job-queue/types.js";
import { createLogger } from "../../logger/index.js";
import { getRuntimeConfig } from "../../runtime-config.js";
import { AssetService } from "../../service/asset-service.js";
import { ContentService } from "../../service/content-service.js";
import { handleObserveSourceJob } from "./handle.js";

const runtimeConfig = getRuntimeConfig();
const logger = createLogger({
  process: "worker",
  worker: OBSERVE_SOURCE_JOB_NAME,
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
const assetRepository = new AssetRepository(database);
const assetService = new AssetService(assetRepository);
const contentRepository = new ContentRepository(database);
const contentService = new ContentService(contentRepository);
const jobRepository = new JobRepository(database);

boss.on("error", (error) => {
  logger.error("job queue runtime failed.", { error });
});

await boss.start();
await ensureQueue(boss, OBSERVE_SOURCE_JOB_NAME, {
  retryBackoff: true,
  retryDelay: 5,
  retryLimit: 2,
});
await ensureQueue(boss, ACQUIRE_CONTENT_JOB_NAME, {
  retryBackoff: true,
  retryDelay: 5,
  retryLimit: 2,
});

await boss.work<ObserveSourceJobPayload>(
  OBSERVE_SOURCE_JOB_NAME,
  async ([job]) => {
    const result = await handleObserveSourceJob(job.data, {
      assetService,
      contentService,
      jobQueue,
      jobRepository,
      logger,
    });

    if (!result.ok) {
      throw result.error;
    }
  },
);

logger.info("worker started.", {
  queueName: OBSERVE_SOURCE_JOB_NAME,
});
