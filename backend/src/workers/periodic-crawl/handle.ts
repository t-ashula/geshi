import { v7 as uuidv7 } from "uuid";

import type { JobRepository } from "../../db/job-repository.js";
import type {
  JobQueue,
  PeriodicCrawlJobPayload,
} from "../../job-queue/types.js";
import { PERIODIC_CRAWL_JOB_NAME } from "../../job-queue/types.js";
import type { Logger } from "../../logger/index.js";
import type { AppSettingService } from "../../service/app-setting-service.js";
import type { JobService } from "../../service/job-service.js";
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
): Promise<void> {
  const logger = dependencies.logger.child({
    jobId: payload.jobId,
  });

  await dependencies.jobRepository.markRunning(payload.jobId);
  logger.info("periodic crawl job started.");

  try {
    const settings =
      await dependencies.appSettingService.getPeriodicCrawlSettings();

    if (!settings.enabled) {
      logger.info(`periodic crawl disabled.`);
    } else {
      let enqueuedCount = 0;
      let skippedCount = 0;

      const targets =
        await dependencies.sourceService.listPeriodicCrawlTargets();
      const activeSourceIds =
        await dependencies.jobRepository.listQueuedOrRunningObserveSourceIds();
      const latestJobsBySourceId =
        await dependencies.jobRepository.findLatestObserveJobsBySourceIds(
          targets.map((target) => target.sourceId),
        );

      for (const target of targets) {
        if (activeSourceIds.has(target.sourceId)) {
          skippedCount += 1;
          continue;
        }

        const latestJob = latestJobsBySourceId.get(target.sourceId);
        const intervalMs = target.crawlIntervalMinutes * 60 * 1000;

        if (
          latestJob !== undefined &&
          Date.now() - latestJob.createdAt.getTime() < intervalMs
        ) {
          skippedCount += 1;
          continue;
        }

        const enqueueResult =
          await dependencies.jobService.enqueueObserveSourceJob(
            target.sourceId,
          );

        if (!enqueueResult.ok) {
          throw new Error(
            `Periodic crawl target disappeared before enqueue: ${target.sourceId}`,
          );
        }

        enqueuedCount += 1;
      }
      logger.info("observe job enqueued.", {
        enqueuedCount,
        skippedCount,
      });
    }

    const nextJob = await dependencies.jobRepository.createJob({
      id: uuidv7(),
      kind: PERIODIC_CRAWL_JOB_NAME,
      retryable: true,
      sourceId: null,
    });
    const nextStartAt = new Date(
      Date.now() + settings.intervalMinutes * 60 * 1000,
    );
    const queueJobId = await dependencies.jobQueue.enqueueAfter(
      PERIODIC_CRAWL_JOB_NAME,
      { jobId: nextJob.id },
      nextStartAt,
    );

    await dependencies.jobRepository.attachQueueJobId(nextJob.id, queueJobId);
    await dependencies.jobRepository.markSucceeded(payload.jobId);
    logger.info("periodic crawl job completed.", {
      nextStartAt: nextStartAt.toISOString(),
    });
  } catch (error) {
    const failureMessage =
      error instanceof Error ? error.message : "Periodic crawl job failed.";

    await dependencies.jobRepository.markFailed(
      payload.jobId,
      failureMessage,
      true,
    );
    logger.error("periodic crawl job failed.", {
      error,
      failureMessage,
    });
    throw error;
  }
}
