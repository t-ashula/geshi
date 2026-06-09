import { serve } from "@hono/node-server";
import { Pool } from "pg";

import { createApp } from "./app.js";
import { AppSettingRepository } from "./db/app-setting-repository.js";
import { AssetRepository } from "./db/asset-repository.js";
import { ContentRepository } from "./db/content-repository.js";
import { createDatabaseFromPool } from "./db/database.js";
import { DetailBodyRepository } from "./db/detail-body-repository.js";
import { JobRepository } from "./db/job-repository.js";
import { PluginGlobalRuntimeStateRepository } from "./db/plugin-global-runtime-state-repository.js";
import { SourceDetectionRepository } from "./db/source-detection-repository.js";
import { SourceRepository } from "./db/source-repository.js";
import { TranscriptRepository } from "./db/transcript-repository.js";
import {
  createPgBoss,
  ensureQueue,
  PgBossJobQueue,
} from "./job-queue/pg-boss.js";
import {
  ACQUIRE_CONTENT_JOB_NAME,
  OBSERVE_SOURCE_JOB_NAME,
  PERIODIC_CRAWL_JOB_NAME,
  TRANSCRIPT_CHUNK_JOB_NAME,
  TRANSCRIPT_SPLIT_JOB_NAME,
} from "./job-queue/types.js";
import { createLogger } from "./logger/index.js";
import { getRuntimeConfig } from "./runtime-config.js";
import { createAppSettingService } from "./service/app-setting-service.js";
import { createAssetService } from "./service/asset-service.js";
import { createContentService } from "./service/content-service.js";
import { createDetailBodyService } from "./service/detail-body-service.js";
import { createJobService } from "./service/job-service.js";
import { createPluginGlobalSettingsService } from "./service/plugin-global-settings-service.js";
import { createSourceDiscoveryService } from "./service/source-discovery-service.js";
import { createSourceDetectionService } from "./service/source-detection-service.js";
import { createSourceInspectService } from "./service/source-inspect-service.js";
import { createSourceService } from "./service/source-service.js";
import { createTranscriptService } from "./service/transcript-service.js";
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
const appSettingService = createAppSettingService(appSettingRepository);
const assetRepository = new AssetRepository(database);
const assetService = createAssetService(assetRepository);
const contentRepository = new ContentRepository(database);
const contentService = createContentService(contentRepository);
const detailBodyRepository = new DetailBodyRepository(database);
const jobRepository = new JobRepository(database);
const pluginGlobalRuntimeStateRepository =
  new PluginGlobalRuntimeStateRepository(database);
const pluginGlobalSettingsService = createPluginGlobalSettingsService({
  pluginGlobalRuntimeStateRepository,
});
const sourceDetectionRepository = new SourceDetectionRepository(database);
const sourceRepository = new SourceRepository(database);
const sourceService = createSourceService(sourceRepository, {
  logger: logger.child({
    service: "source",
  }),
});
const sourceInspectService = createSourceInspectService({
  logger: logger.child({
    service: "source-inspect",
  }),
  pluginGlobalRuntimeStateRepository,
});
const sourceDiscoveryService = createSourceDiscoveryService({
  logger: logger.child({
    service: "source-discovery",
  }),
  pluginGlobalRuntimeStateRepository,
});
const sourceDetectionService = createSourceDetectionService(
  sourceDetectionRepository,
  sourceService,
  {
    logger: logger.child({
      service: "source-detection",
    }),
    pluginGlobalRuntimeStateRepository,
  },
);
const jobQueue = new PgBossJobQueue(boss);
const jobService = createJobService(sourceService, jobRepository, jobQueue);
const transcriptRepository = new TranscriptRepository(database);
const transcriptService = createTranscriptService(
  assetService,
  database,
  jobQueue,
  jobRepository,
  transcriptRepository,
);
const storage = new FilesystemStorage(runtimeConfig.storageRootDir);
const detailBodyService = createDetailBodyService(
  detailBodyRepository,
  storage,
  {
    logger: logger.child({
      service: "detail-body",
    }),
    pluginGlobalRuntimeStateRepository,
  },
);

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
await ensureQueue(boss, TRANSCRIPT_SPLIT_JOB_NAME, queueOptions);
await ensureQueue(boss, TRANSCRIPT_CHUNK_JOB_NAME, queueOptions);
const ensureDefaultProfileResult =
  await appSettingService.ensureDefaultProfile();

if (!ensureDefaultProfileResult.ok) {
  throw ensureDefaultProfileResult.error;
}

const app = createApp({
  appSettingService,
  assetService,
  contentService,
  detailBodyService,
  jobService,
  pluginGlobalSettingsService,
  sourceDiscoveryService,
  sourceDetectionService,
  sourceInspectService,
  sourceService,
  storage,
  transcriptService,
});

serve({
  fetch: app.fetch,
  port: runtimeConfig.backendPort,
});

logger.info("backend started.", {
  backendPort: runtimeConfig.backendPort,
});
