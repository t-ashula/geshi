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
import type {
  SourceCollectorExpirationAction,
  SourceCollectorNonActionableReason,
} from "../../plugins/types.js";

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
  const enqueueWindowEndsAt = now + RECORDING_SCHEDULER_INTERVAL_MS;
  let enqueuedCount = 0;

  for (const job of queuedJobsResult.value) {
    const scheduledStartAt = readScheduledStartAt(job.metadata);
    const latestRunnableAt = readLatestRunnableAt(job.metadata);
    const expirationPolicy = readExpirationPolicy(job.metadata);

    if (
      latestRunnableAt !== null &&
      latestRunnableAt.getTime() < now &&
      expirationPolicy !== null
    ) {
      const cleanupResult = await cleanupExpiredRecordJob(
        job.id,
        job.metadata,
        expirationPolicy,
        dependencies,
        logger,
      );

      if (!cleanupResult.ok) {
        return cleanupResult;
      }

      continue;
    }

    if (
      scheduledStartAt !== null &&
      scheduledStartAt.getTime() > enqueueWindowEndsAt
    ) {
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
    enqueueWindowEndsAt: new Date(enqueueWindowEndsAt).toISOString(),
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

function readLatestRunnableAt(metadata: Record<string, unknown>): Date | null {
  const coreMetadata = metadata.core;

  if (
    typeof coreMetadata !== "object" ||
    coreMetadata === null ||
    Array.isArray(coreMetadata)
  ) {
    return null;
  }

  const latestRunnableAt = (coreMetadata as Record<string, unknown>)
    .latestRunnableAt;

  if (typeof latestRunnableAt !== "string") {
    return null;
  }

  const date = new Date(latestRunnableAt);

  return Number.isNaN(date.getTime()) ? null : date;
}

function readExpirationPolicy(metadata: Record<string, unknown>): {
  action: SourceCollectorExpirationAction;
  message: string | null;
  reason: SourceCollectorNonActionableReason;
} | null {
  const coreMetadata = metadata.core;

  if (
    typeof coreMetadata !== "object" ||
    coreMetadata === null ||
    Array.isArray(coreMetadata)
  ) {
    return null;
  }

  const expirationPolicy = (coreMetadata as Record<string, unknown>)
    .expirationPolicy;

  if (
    typeof expirationPolicy !== "object" ||
    expirationPolicy === null ||
    Array.isArray(expirationPolicy)
  ) {
    return null;
  }

  const action = (expirationPolicy as Record<string, unknown>).action;
  const reason = (expirationPolicy as Record<string, unknown>).reason;
  const message = (expirationPolicy as Record<string, unknown>).message;

  if (
    (action !== "mark_failed" && action !== "mark_non_actionable") ||
    !isNonActionableReason(reason)
  ) {
    return null;
  }

  return {
    action,
    message: typeof message === "string" ? message : null,
    reason,
  };
}

function isNonActionableReason(
  value: unknown,
): value is SourceCollectorNonActionableReason {
  return (
    value === "already-ended" ||
    value === "missed-recording-window" ||
    value === "outside-retention-window" ||
    value === "requires-manual-action" ||
    value === "unsupported"
  );
}

async function cleanupExpiredRecordJob(
  jobId: string,
  metadata: Record<string, unknown>,
  expirationPolicy: {
    action: SourceCollectorExpirationAction;
    message: string | null;
    reason: SourceCollectorNonActionableReason;
  },
  dependencies: HandleRecordingSchedulerJobDependencies,
  logger: Logger,
): Promise<Result<void, Error>> {
  const cleanupMetadata = withCleanupMetadata(metadata, expirationPolicy);
  const replaceMetadataResult =
    await dependencies.jobRepository.replaceMetadata(jobId, cleanupMetadata);

  if (!replaceMetadataResult.ok) {
    return replaceMetadataResult;
  }

  const failureMessage =
    expirationPolicy.message ??
    `Record job expired: ${expirationPolicy.reason}.`;
  const markFailedResult = await dependencies.jobRepository.markFailed(
    jobId,
    failureMessage,
    false,
  );

  if (!markFailedResult.ok) {
    return markFailedResult;
  }

  logger.warn("recording scheduler cleaned up expired record job.", {
    cleanupAction: expirationPolicy.action,
    failureMessage,
    reason: expirationPolicy.reason,
    targetJobId: jobId,
  });

  return ok(undefined);
}

function withCleanupMetadata(
  metadata: Record<string, unknown>,
  expirationPolicy: {
    action: SourceCollectorExpirationAction;
    message: string | null;
    reason: SourceCollectorNonActionableReason;
  },
): Record<string, unknown> {
  const coreMetadata = metadata.core;

  if (
    typeof coreMetadata !== "object" ||
    coreMetadata === null ||
    Array.isArray(coreMetadata)
  ) {
    return metadata;
  }

  return {
    ...metadata,
    core: {
      ...(coreMetadata as Record<string, unknown>),
      cleanup: {
        action: expirationPolicy.action,
        cleanedUpAt: new Date().toISOString(),
        message: expirationPolicy.message,
        reason: expirationPolicy.reason,
      },
    },
  };
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
