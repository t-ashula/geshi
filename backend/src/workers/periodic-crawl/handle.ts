import { v7 as uuidv7 } from "uuid";

import type { JobRepository } from "../../db/job-repository.js";
import type {
  JobQueue,
  PeriodicCrawlJobPayload,
} from "../../job-queue/types.js";
import { PERIODIC_CRAWL_JOB_NAME } from "../../job-queue/types.js";
import type { Result } from "../../lib/result.js";
import { err, ok } from "../../lib/result.js";
import type { Logger } from "../../logger/index.js";
import type { AppSettingService } from "../../service/app-setting-service.js";
import type { JobService } from "../../service/job-service.js";
import type { PeriodicCrawlAppSettings } from "../../service/periodic-crawl-settings.js";
import type { SourceService } from "../../service/source-service.js";

type HandlePeriodicCrawlJobDependencies = {
  appSettingService: AppSettingService;
  jobQueue: JobQueue;
  jobRepository: JobRepository;
  jobService: JobService;
  logger: Logger;
  sourceService: SourceService;
};

export async function handlePeriodicCrawlJob(
  payload: PeriodicCrawlJobPayload,
  dependencies: HandlePeriodicCrawlJobDependencies,
): Promise<Result<void, Error>> {
  const logger = dependencies.logger.child({
    jobId: payload.jobId,
  });

  const markRunningResult = await dependencies.jobRepository.markRunning(
    payload.jobId,
  );

  if (!markRunningResult.ok) {
    return markRunningResult;
  }

  logger.info("periodic crawl job started.");

  const settings =
    await dependencies.appSettingService.getPeriodicCrawlSettings();

  if (!settings.ok) {
    await failPeriodicCrawlJob(
      payload.jobId,
      dependencies,
      logger,
      settings.error,
    );
    return settings;
  }

  if (!settings.value.enabled) {
    logger.info(`periodic crawl disabled.`);
  } else {
    const enqueueResult = await enqueueObserveJobs(dependencies);

    if (!enqueueResult.ok) {
      await failPeriodicCrawlJob(
        payload.jobId,
        dependencies,
        logger,
        enqueueResult.error,
      );
      return enqueueResult;
    }

    logger.info("observe job enqueued.", enqueueResult.value);
  }

  const scheduleNextJobResult = await scheduleNextPeriodicCrawlJob(
    settings.value,
    dependencies,
  );

  if (!scheduleNextJobResult.ok) {
    await failPeriodicCrawlJob(
      payload.jobId,
      dependencies,
      logger,
      scheduleNextJobResult.error,
    );
    return scheduleNextJobResult;
  }

  const markSucceededResult = await dependencies.jobRepository.markSucceeded(
    payload.jobId,
  );

  if (!markSucceededResult.ok) {
    return markSucceededResult;
  }

  logger.info("periodic crawl job completed.", {
    nextStartAt: scheduleNextJobResult.value.nextStartAt.toISOString(),
  });

  return ok(undefined);
}

async function enqueueObserveJobs(
  dependencies: HandlePeriodicCrawlJobDependencies,
): Promise<Result<{ enqueuedCount: number; skippedCount: number }, Error>> {
  const targets = await dependencies.sourceService.listPeriodicCrawlTargets();

  if (!targets.ok) {
    return targets;
  }

  const activeSourceIds =
    await dependencies.jobRepository.listQueuedOrRunningObserveSourceIds();

  if (!activeSourceIds.ok) {
    return activeSourceIds;
  }

  const latestJobsBySourceId =
    await dependencies.jobRepository.findLatestObserveJobsBySourceIds(
      targets.value.map((target) => target.sourceId),
    );

  if (!latestJobsBySourceId.ok) {
    return latestJobsBySourceId;
  }

  let enqueuedCount = 0;
  let skippedCount = 0;

  for (const target of targets.value) {
    if (activeSourceIds.value.has(target.sourceId)) {
      skippedCount += 1;
      continue;
    }

    const latestJob = latestJobsBySourceId.value.get(target.sourceId);
    const intervalMs = target.crawlIntervalMinutes * 60 * 1000;

    if (
      latestJob !== undefined &&
      Date.now() - latestJob.createdAt.getTime() < intervalMs
    ) {
      skippedCount += 1;
      continue;
    }

    const enqueueResult = await dependencies.jobService.enqueueObserveSourceJob(
      target.sourceId,
    );

    if (!enqueueResult.ok) {
      return err(
        enqueueResult.error instanceof Error
          ? enqueueResult.error
          : new Error(
              `Periodic crawl target disappeared before enqueue: ${target.sourceId}`,
            ),
      );
    }

    enqueuedCount += 1;
  }

  return ok({
    enqueuedCount,
    skippedCount,
  });
}

async function scheduleNextPeriodicCrawlJob(
  settings: PeriodicCrawlAppSettings,
  dependencies: HandlePeriodicCrawlJobDependencies,
): Promise<Result<{ nextStartAt: Date }, Error>> {
  const nextJob = await dependencies.jobRepository.createJob({
    id: uuidv7(),
    kind: PERIODIC_CRAWL_JOB_NAME,
    retryable: true,
    sourceId: null,
  });

  if (!nextJob.ok) {
    return nextJob;
  }

  const nextStartAt = new Date(
    Date.now() + settings.intervalMinutes * 60 * 1000,
  );
  const queueJobId = await dependencies.jobQueue.enqueueAfter(
    PERIODIC_CRAWL_JOB_NAME,
    { jobId: nextJob.value.id },
    nextStartAt,
  );
  const attachQueueJobIdResult =
    await dependencies.jobRepository.attachQueueJobId(
      nextJob.value.id,
      queueJobId,
    );

  if (!attachQueueJobIdResult.ok) {
    return attachQueueJobIdResult;
  }

  return ok({ nextStartAt });
}

async function failPeriodicCrawlJob(
  jobId: string,
  dependencies: HandlePeriodicCrawlJobDependencies,
  logger: Logger,
  error: unknown,
): Promise<void> {
  const failureMessage =
    error instanceof Error ? error.message : "Periodic crawl job failed.";

  const markFailedResult = await dependencies.jobRepository.markFailed(
    jobId,
    failureMessage,
    true,
  );

  if (!markFailedResult.ok) {
    logger.error("periodic crawl job failure could not be persisted.", {
      error: markFailedResult.error,
      failureMessage,
    });
    return;
  }

  logger.error("periodic crawl job failed.", {
    error,
    failureMessage,
  });
}
