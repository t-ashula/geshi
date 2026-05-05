import { v7 as uuidv7 } from "uuid";

import type { JobRepository } from "../../db/job-repository.js";
import type {
  JobQueue,
  RecordContentJobPayload,
  RecordingSchedulerJobPayload,
} from "../../job-queue/types.js";
import {
  RECORD_CONTENT_JOB_NAME,
  RECORDING_SCHEDULER_JOB_NAME,
} from "../../job-queue/types.js";
import type { Result } from "../../lib/result.js";
import { ok } from "../../lib/result.js";
import type { Logger } from "../../logger/index.js";

type HandleRecordingSchedulerJobDependencies = {
  jobQueue: JobQueue;
  jobRepository: JobRepository;
  logger: Logger;
  startRecordContentWorker: () => Promise<void>;
};

const RECORDING_SCHEDULER_INTERVAL_MS = 30_000;

export async function handleRecordingSchedulerJob(
  payload: RecordingSchedulerJobPayload,
  dependencies: HandleRecordingSchedulerJobDependencies,
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

  logger.info("recording scheduler job started.");

  const queuedJobsResult =
    await dependencies.jobRepository.listQueuedJobsWithoutQueueIdByKind(
      RECORD_CONTENT_JOB_NAME,
    );

  if (!queuedJobsResult.ok) {
    return queuedJobsResult;
  }

  const now = Date.now();
  let enqueuedCount = 0;

  for (const job of queuedJobsResult.value) {
    const scheduledStartAt = readScheduledStartAt(job.metadata);

    if (scheduledStartAt !== null && scheduledStartAt.getTime() > now) {
      continue;
    }

    const queuePayload = readRecordContentPayload(job.metadata);

    if (queuePayload === null) {
      continue;
    }

    const queueJobId = await dependencies.jobQueue.enqueue(
      RECORD_CONTENT_JOB_NAME,
      queuePayload,
    );

    const attachQueueJobIdResult =
      await dependencies.jobRepository.attachQueueJobId(job.id, queueJobId);

    if (!attachQueueJobIdResult.ok) {
      return attachQueueJobIdResult;
    }

    await dependencies.startRecordContentWorker();

    enqueuedCount += 1;
  }

  const nextJob = await dependencies.jobRepository.createJob({
    id: uuidv7(),
    kind: RECORDING_SCHEDULER_JOB_NAME,
    retryable: true,
    sourceId: null,
  });

  if (!nextJob.ok) {
    return nextJob;
  }

  const nextStartAt = new Date(Date.now() + RECORDING_SCHEDULER_INTERVAL_MS);
  const queueJobId = await dependencies.jobQueue.enqueueAfter(
    RECORDING_SCHEDULER_JOB_NAME,
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

  const markSucceededResult = await dependencies.jobRepository.markSucceeded(
    payload.jobId,
  );

  if (!markSucceededResult.ok) {
    return markSucceededResult;
  }

  logger.info("recording scheduler job completed.", {
    enqueuedCount,
    nextStartAt: nextStartAt.toISOString(),
  });

  return ok(undefined);
}
function readScheduledStartAt(metadata: Record<string, unknown>): Date | null {
  const coreMetadata = metadata.core;

  if (
    typeof coreMetadata !== "object" ||
    coreMetadata === null ||
    Array.isArray(coreMetadata)
  ) {
    return null;
  }

  const scheduledStartAt = (coreMetadata as Record<string, unknown>)
    .scheduledStartAt;

  if (typeof scheduledStartAt !== "string") {
    return null;
  }

  const date = new Date(scheduledStartAt);

  return Number.isNaN(date.getTime()) ? null : date;
}

function readRecordContentPayload(
  metadata: Record<string, unknown>,
): RecordContentJobPayload | null {
  const coreMetadata = metadata.core;

  if (
    typeof coreMetadata !== "object" ||
    coreMetadata === null ||
    Array.isArray(coreMetadata)
  ) {
    return null;
  }

  const payload = (coreMetadata as Record<string, unknown>).payload;

  if (
    typeof payload !== "object" ||
    payload === null ||
    Array.isArray(payload)
  ) {
    return null;
  }

  return payload as RecordContentJobPayload;
}
