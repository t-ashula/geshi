import { serve } from "@hono/node-server";
import { Pool } from "pg";

import { createApp } from "./app.js";
import { ContentRepository } from "./db/content-repository.js";
import { createDatabaseFromPool } from "./db/database.js";
import { JobRepository } from "./db/job-repository.js";
import { SourceRepository } from "./db/source-repository.js";
import { ensureQueue, PgBossJobQueue } from "./job-queue/pg-boss.js";
import { createPgBoss } from "./job-queue/pg-boss.js";
import {
  ACQUIRE_CONTENT_JOB_NAME,
  OBSERVE_SOURCE_JOB_NAME,
} from "./job-queue/types.js";
import { createLogger } from "./logger/index.js";
import { getRuntimeConfig } from "./runtime-config.js";
import { ContentService } from "./service/content-service.js";
import { JobService } from "./service/job-service.js";
import { SourceInspectService } from "./service/source-inspect-service.js";
import { SourceService } from "./service/source-service.js";

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
const contentRepository = new ContentRepository(database);
const contentService = new ContentService(contentRepository);
const jobRepository = new JobRepository(database);
const sourceRepository = new SourceRepository(database);
const sourceService = new SourceService(sourceRepository);
const sourceInspectService = new SourceInspectService();
const jobQueue = new PgBossJobQueue(boss);
const jobService = new JobService(sourceService, jobRepository, jobQueue);

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

const app = createApp(
  sourceService,
  sourceInspectService,
  contentService,
  jobService,
);

serve({
  fetch: app.fetch,
  port: runtimeConfig.backendPort,
});

logger.info("backend started.", {
  backendPort: runtimeConfig.backendPort,
});
