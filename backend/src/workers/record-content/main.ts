import { Pool } from "pg";

import { AssetRepository } from "../../db/asset-repository.js";
import { CollectorPluginStateRepository } from "../../db/collector-plugin-state-repository.js";
import { ContentRepository } from "../../db/content-repository.js";
import { createDatabaseFromPool } from "../../db/database.js";
import { JobRepository } from "../../db/job-repository.js";
import { createPgBoss, ensureQueue } from "../../job-queue/pg-boss.js";
import type { RecordContentJobPayload } from "../../job-queue/types.js";
import { RECORD_CONTENT_JOB_NAME } from "../../job-queue/types.js";
import { createLogger } from "../../logger/index.js";
import type { SourceCollectorRegistry } from "../../plugins/index.js";
import { getRuntimeConfig } from "../../runtime-config.js";
import { createAssetService } from "../../service/asset-service.js";
import { createContentService } from "../../service/content-service.js";
import { FilesystemStorage } from "../../storage/filesystem-storage.js";
import { handleRecordContentJob } from "./handle.js";

const RECORD_CONTENT_EXPIRE_IN_SECONDS = 12 * 60 * 60;
const RECORD_CONTENT_HEARTBEAT_SECONDS = 60;
const RECORD_CONTENT_POLLING_INTERVAL_SECONDS = 0.5;

const runtimeConfig = getRuntimeConfig();
const logger = createLogger({
  process: "worker",
  worker: RECORD_CONTENT_JOB_NAME,
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
const collectorPluginStateRepository = new CollectorPluginStateRepository(
  database,
);
const contentRepository = new ContentRepository(database);
const contentService = createContentService(contentRepository);
const jobRepository = new JobRepository(database);
const storage = new FilesystemStorage(runtimeConfig.storageRootDir);
const workStorage = new FilesystemStorage(runtimeConfig.workStorageRootDir);
const firstJobFinished = Promise.withResolvers<void>();
let firstJobFinishedResolved = false;

logger.info("worker bootstrap started.", {
  pid: process.pid,
  queueName: RECORD_CONTENT_JOB_NAME,
});

boss.on("error", (error) => {
  logger.error("job queue runtime failed.", { error });
});

await boss.start();
logger.info("job queue runtime started.", {
  pid: process.pid,
  queueName: RECORD_CONTENT_JOB_NAME,
});

await ensureQueue(boss, RECORD_CONTENT_JOB_NAME, {
  expireInSeconds: RECORD_CONTENT_EXPIRE_IN_SECONDS,
  heartbeatSeconds: RECORD_CONTENT_HEARTBEAT_SECONDS,
});
logger.info("job queue ensured.", {
  pid: process.pid,
  queueName: RECORD_CONTENT_JOB_NAME,
});

logger.info("source collector registry loading started.", {
  pid: process.pid,
});
const sourceCollectorRegistryLoadStartedAt = Date.now();
const { defaultSourceCollectorRegistry } =
  (await import("../../plugins/index.js")) as {
    defaultSourceCollectorRegistry: SourceCollectorRegistry;
  };
logger.info("source collector registry loading completed.", {
  elapsedMilliseconds: Date.now() - sourceCollectorRegistryLoadStartedAt,
  pid: process.pid,
});

await boss.work<RecordContentJobPayload>(
  RECORD_CONTENT_JOB_NAME,
  {
    batchSize: 1,
    localConcurrency: 1,
    pollingIntervalSeconds: RECORD_CONTENT_POLLING_INTERVAL_SECONDS,
  },
  async ([job]) => {
    try {
      logger.info("worker started.", {
        jobId: job.data.jobId,
        queueJobId: job.id,
        queueName: RECORD_CONTENT_JOB_NAME,
      });

      const result = await handleRecordContentJob(job.data, {
        assetService,
        collectorPluginStateRepository,
        contentService,
        jobRepository,
        logger,
        sourceCollectorRegistry: defaultSourceCollectorRegistry,
        storage,
        workStorage,
      });

      if (!result.ok) {
        throw result.error;
      }
    } finally {
      if (!firstJobFinishedResolved) {
        firstJobFinishedResolved = true;
        firstJobFinished.resolve();
      }
    }
  },
);
logger.info("job queue worker registered.", {
  pid: process.pid,
  pollingIntervalSeconds: RECORD_CONTENT_POLLING_INTERVAL_SECONDS,
  queueName: RECORD_CONTENT_JOB_NAME,
});

logger.info("worker started.", {
  pid: process.pid,
  queueName: RECORD_CONTENT_JOB_NAME,
});

await firstJobFinished.promise;

await boss.stop();
await pool.end();
