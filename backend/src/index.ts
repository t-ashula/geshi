import { serve } from "@hono/node-server";
import { Pool } from "pg";

import { createApp } from "./app.js";
import { AppSettingRepository } from "./db/app-setting-repository.js";
import { AssetRepository } from "./db/asset-repository.js";
import { ContentRepository } from "./db/content-repository.js";
import { createDatabaseFromPool } from "./db/database.js";
import { JobRepository } from "./db/job-repository.js";
import { SourceRepository } from "./db/source-repository.js";
import {
  createPgBoss,
  ensureQueue,
  PgBossJobQueue,
} from "./job-queue/pg-boss.js";
import {
  ACQUIRE_CONTENT_JOB_NAME,
  OBSERVE_SOURCE_JOB_NAME,
  PERIODIC_CRAWL_JOB_NAME,
} from "./job-queue/types.js";
import { createLogger } from "./logger/index.js";
import { getRuntimeConfig } from "./runtime-config.js";
import { AppSettingService } from "./service/app-setting-service.js";
import { AssetService } from "./service/asset-service.js";
import { ContentService } from "./service/content-service.js";
import { JobService } from "./service/job-service.js";
import { SourceInspectService } from "./service/source-inspect-service.js";
import { SourceService } from "./service/source-service.js";
import { FilesystemStorage } from "./storage/filesystem-storage.js";

const runtimeConfig = getRuntimeConfig();
const logger = createLogger({
  process: "backend",
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
const appSettingRepository = new AppSettingRepository(database);
const appSettingService = new AppSettingService(appSettingRepository);
const assetRepository = new AssetRepository(database);
const assetService = new AssetService(assetRepository);
const contentRepository = new ContentRepository(database);
const contentService = new ContentService(contentRepository);
const jobRepository = new JobRepository(database);
const sourceRepository = new SourceRepository(database);
const sourceService = new SourceService(sourceRepository);
const sourceInspectService = new SourceInspectService();
const jobQueue = new PgBossJobQueue(boss);
const jobService = new JobService(sourceService, jobRepository, jobQueue);
const storage = new FilesystemStorage(runtimeConfig.storageRootDir);

boss.on("error", (error) => {
  logger.error("job queue runtime failed.", { error });
});

const queueOptions = {
  retryBackoff: true,
  retryDelay: 5,
  retryLimit: 2,
};
await boss.start();
await ensureQueue(boss, OBSERVE_SOURCE_JOB_NAME, queueOptions);
await ensureQueue(boss, ACQUIRE_CONTENT_JOB_NAME, queueOptions);
await ensureQueue(boss, PERIODIC_CRAWL_JOB_NAME, queueOptions);
const ensureDefaultProfileResult =
  await appSettingService.ensureDefaultProfile();

if (!ensureDefaultProfileResult.ok) {
  throw ensureDefaultProfileResult.error;
}

const app = createApp(
  sourceService,
  sourceInspectService,
  assetService,
  contentService,
  jobService,
  appSettingService,
  storage,
);

serve({
  fetch: app.fetch,
  port: runtimeConfig.backendPort,
});

logger.info("backend started.", {
  backendPort: runtimeConfig.backendPort,
});
