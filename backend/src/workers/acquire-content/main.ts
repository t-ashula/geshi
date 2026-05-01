import { Pool } from "pg";

import { AssetRepository } from "../../db/asset-repository.js";
import { ContentRepository } from "../../db/content-repository.js";
import { createDatabaseFromPool } from "../../db/database.js";
import { JobRepository } from "../../db/job-repository.js";
import { createPgBoss, ensureQueue } from "../../job-queue/pg-boss.js";
import type { AcquireContentJobPayload } from "../../job-queue/types.js";
import { ACQUIRE_CONTENT_JOB_NAME } from "../../job-queue/types.js";
import { createLogger } from "../../logger/index.js";
import { getRuntimeConfig } from "../../runtime-config.js";
import { createAssetService } from "../../service/asset-service.js";
import { createContentService } from "../../service/content-service.js";
import { FilesystemStorage } from "../../storage/filesystem-storage.js";
import { handleAcquireContentJob } from "./handle.js";

const runtimeConfig = getRuntimeConfig();
const logger = createLogger({
  process: "worker",
  worker: ACQUIRE_CONTENT_JOB_NAME,
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
const assetRepository = new AssetRepository(database);
const assetService = createAssetService(assetRepository);
const contentRepository = new ContentRepository(database);
const contentService = createContentService(contentRepository);
const jobRepository = new JobRepository(database);
const storage = new FilesystemStorage(runtimeConfig.storageRootDir);

boss.on("error", (error) => {
  logger.error("job queue runtime failed.", { error });
});

await boss.start();
await ensureQueue(boss, ACQUIRE_CONTENT_JOB_NAME, {
  retryBackoff: true,
  retryDelay: 5,
  retryLimit: 2,
});

await boss.work<AcquireContentJobPayload>(
  ACQUIRE_CONTENT_JOB_NAME,
  async ([job]) => {
    const result = await handleAcquireContentJob(job.data, {
      assetService,
      contentService,
      jobRepository,
      logger,
      storage,
    });

    if (!result.ok) {
      throw result.error;
    }
  },
);

logger.info("worker started.", {
  queueName: ACQUIRE_CONTENT_JOB_NAME,
});
