import { Pool } from "pg";

import { ContentRepository } from "../../db/content-repository.js";
import { createDatabaseFromPool } from "../../db/database.js";
import { JobRepository } from "../../db/job-repository.js";
import { createPgBoss } from "../../job-queue/pg-boss.js";
import { ensureQueue } from "../../job-queue/pg-boss.js";
import type { ObserveSourceJobPayload } from "../../job-queue/types.js";
import { OBSERVE_SOURCE_JOB_NAME } from "../../job-queue/types.js";
import { getRuntimeConfig } from "../../runtime-config.js";
import { ContentService } from "../../service/content-service.js";
import { handleObserveSourceJob } from "./handle.js";

const runtimeConfig = getRuntimeConfig();
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

boss.on("error", (error) => {
  console.error(error);
});

await boss.start();
await ensureQueue(boss, OBSERVE_SOURCE_JOB_NAME, {
  retryBackoff: true,
  retryDelay: 5,
  retryLimit: 2,
});

await boss.work<ObserveSourceJobPayload>(
  OBSERVE_SOURCE_JOB_NAME,
  async ([job]) => {
    await handleObserveSourceJob(job.data, {
      contentService,
      jobRepository,
    });
  },
);
