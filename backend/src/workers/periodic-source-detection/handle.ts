import { v7 as uuidv7 } from "uuid";

import type { JobRepository } from "../../db/job-repository.js";
import type {
  JobQueue,
  PeriodicSourceDetectionJobPayload,
} from "../../job-queue/types.js";
import { PERIODIC_SOURCE_DETECTION_JOB_NAME } from "../../job-queue/types.js";
import type { Result } from "../../lib/result.js";
import { ok } from "../../lib/result.js";
import type { Logger } from "../../logger/index.js";
import type { SourceDetectionService } from "../../service/source-detection-service.js";

type HandlePeriodicSourceDetectionJobDependencies = {
  jobQueue: JobQueue;
  jobRepository: JobRepository;
  logger: Logger;
  sourceDetectionService: SourceDetectionService;
};

const DEFAULT_SCHEDULER_INTERVAL_MINUTES = 60;

export async function handlePeriodicSourceDetectionJob(
  payload: PeriodicSourceDetectionJobPayload,
  dependencies: HandlePeriodicSourceDetectionJobDependencies,
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

  logger.info("periodic source detection job started.");

  const targetsResult =
    await dependencies.sourceDetectionService.listEnabledTargets();

  if (!targetsResult.ok) {
    return failPeriodicSourceDetectionJob(
      payload.jobId,
      dependencies,
      logger,
      targetsResult.error,
    );
  }

  let processedTargetCount = 0;
  let skippedTargetCount = 0;

  for (const target of targetsResult.value) {
    if (!isTargetDue(target.lastCheckedAt, target.intervalMinutes)) {
      skippedTargetCount += 1;
      continue;
    }

    const detectResult =
      await dependencies.sourceDetectionService.detectSourceTarget(target);

    if (!detectResult.ok) {
      return failPeriodicSourceDetectionJob(
        payload.jobId,
        dependencies,
        logger,
        detectResult.error,
      );
    }

    processedTargetCount += 1;
  }

  const scheduleNextJobResult = await scheduleNextPeriodicSourceDetectionJob(
    targetsResult.value.map((target) => target.intervalMinutes),
    dependencies,
  );

  if (!scheduleNextJobResult.ok) {
    return failPeriodicSourceDetectionJob(
      payload.jobId,
      dependencies,
      logger,
      scheduleNextJobResult.error,
    );
  }

  const markSucceededResult = await dependencies.jobRepository.markSucceeded(
    payload.jobId,
  );

  if (!markSucceededResult.ok) {
    return markSucceededResult;
  }

  logger.info("periodic source detection job completed.", {
    nextStartAt: scheduleNextJobResult.value.nextStartAt.toISOString(),
    processedTargetCount,
    skippedTargetCount,
  });

  return ok(undefined);
}

function isTargetDue(
  lastCheckedAt: Date | null,
  intervalMinutes: number,
): boolean {
  if (lastCheckedAt === null) {
    return true;
  }

  return Date.now() - lastCheckedAt.getTime() >= intervalMinutes * 60 * 1000;
}

async function scheduleNextPeriodicSourceDetectionJob(
  targetIntervalsMinutes: number[],
  dependencies: HandlePeriodicSourceDetectionJobDependencies,
): Promise<Result<{ nextStartAt: Date }, Error>> {
  const nextJobId = uuidv7();
  const queuePayload = { jobId: nextJobId };
  const createJobResult = await dependencies.jobRepository.createJob({
    id: nextJobId,
    kind: PERIODIC_SOURCE_DETECTION_JOB_NAME,
    payload: queuePayload,
    retryable: true,
  });

  if (!createJobResult.ok) {
    return createJobResult;
  }

  const shortestIntervalMinutes =
    targetIntervalsMinutes.length === 0
      ? DEFAULT_SCHEDULER_INTERVAL_MINUTES
      : Math.min(...targetIntervalsMinutes, DEFAULT_SCHEDULER_INTERVAL_MINUTES);
  const nextStartAt = new Date(
    Date.now() + shortestIntervalMinutes * 60 * 1000,
  );
  const queueJobId = await dependencies.jobQueue.enqueueAfter(
    PERIODIC_SOURCE_DETECTION_JOB_NAME,
    queuePayload,
    nextStartAt,
  );
  const attachQueueJobIdResult =
    await dependencies.jobRepository.attachQueueJobId(
      createJobResult.value.id,
      queueJobId,
    );

  if (!attachQueueJobIdResult.ok) {
    return attachQueueJobIdResult;
  }

  return ok({
    nextStartAt,
  });
}

async function failPeriodicSourceDetectionJob(
  jobId: string,
  dependencies: HandlePeriodicSourceDetectionJobDependencies,
  logger: Logger,
  error: unknown,
): Promise<Result<void, Error>> {
  const failureMessage =
    error instanceof Error
      ? error.message
      : "Periodic source detection job failed.";
  const markFailedResult = await dependencies.jobRepository.markFailed(
    jobId,
    failureMessage,
    true,
  );

  if (!markFailedResult.ok) {
    return markFailedResult;
  }

  logger.error("periodic source detection job failed.", {
    error,
    failureMessage,
  });

  return error instanceof Error
    ? { ok: false, error }
    : { ok: false, error: new Error(failureMessage) };
}
