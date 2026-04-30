import { Pool } from "pg";
import { v7 as uuidv7 } from "uuid";

import { AppSettingRepository } from "../../db/app-setting-repository.js";
import { createDatabaseFromPool } from "../../db/database.js";
import { JobRepository } from "../../db/job-repository.js";
import { SourceRepository } from "../../db/source-repository.js";
import {
  createPgBoss,
  ensureQueue,
  PgBossJobQueue,
} from "../../job-queue/pg-boss.js";
import type { PeriodicCrawlJobPayload } from "../../job-queue/types.js";
import {
  OBSERVE_SOURCE_JOB_NAME,
  PERIODIC_CRAWL_JOB_NAME,
} from "../../job-queue/types.js";
import { createLogger } from "../../logger/index.js";
import { getRuntimeConfig } from "../../runtime-config.js";
import { AppSettingService } from "../../service/app-setting-service.js";
import { JobService } from "../../service/job-service.js";
import { SourceService } from "../../service/source-service.js";
import { handlePeriodicCrawlJob } from "./handle.js";

const runtimeConfig = getRuntimeConfig();
const logger = createLogger({
  process: "worker",
  worker: PERIODIC_CRAWL_JOB_NAME,
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
const jobRepository = new JobRepository(database);
const sourceRepository = new SourceRepository(database);
const sourceService = new SourceService(sourceRepository);
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
await ensureQueue(boss, PERIODIC_CRAWL_JOB_NAME, {
  retryBackoff: true,
  retryDelay: 5,
  retryLimit: 2,
});
await appSettingService.ensureDefaultProfile();

await seedPeriodicCrawlJob(jobRepository, jobQueue);

await boss.work<PeriodicCrawlJobPayload>(
  PERIODIC_CRAWL_JOB_NAME,
  async ([job]) => {
    await handlePeriodicCrawlJob(job.data, {
      appSettingService,
      jobQueue,
      jobRepository,
      jobService,
      logger,
      sourceService,
    });
  },
);

logger.info("worker started.", {
  queueName: PERIODIC_CRAWL_JOB_NAME,
});

async function seedPeriodicCrawlJob(
  currentJobRepository: JobRepository,
  currentJobQueue: PgBossJobQueue,
): Promise<void> {
  const existingJob = await currentJobRepository.findQueuedOrRunningJobByKind(
    PERIODIC_CRAWL_JOB_NAME,
  );

  if (existingJob !== null) {
    return;
  }

  const job = await currentJobRepository.createJob({
    id: uuidv7(),
    kind: PERIODIC_CRAWL_JOB_NAME,
    retryable: true,
    sourceId: null,
  });
  const queueJobId = await currentJobQueue.enqueue(PERIODIC_CRAWL_JOB_NAME, {
    jobId: job.id,
  });

  await currentJobRepository.attachQueueJobId(job.id, queueJobId);
}
