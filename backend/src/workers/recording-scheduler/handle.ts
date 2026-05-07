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

  const dedupeResult = await cleanupSupersededRecordJobs(
    queuedJobsResult.value,
    dependencies,
    logger,
  );

  if (!dedupeResult.ok) {
    return dedupeResult;
  }

  const runningAssetIdsResult =
    await dependencies.jobRepository.listRunningRecordContentAssetIds();

  if (!runningAssetIdsResult.ok) {
    return runningAssetIdsResult;
  }

  const runningAssetIds = runningAssetIdsResult.value;

  const now = Date.now();
  const enqueueWindowEndsAt = now + RECORDING_SCHEDULER_INTERVAL_MS;
  let enqueuedCount = 0;

  for (const job of dedupeResult.value) {
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

    if (runningAssetIds.has(queuePayload.asset.id)) {
      const cleanupResult = await cleanupSupersededRecordJob(
        job.id,
        job.metadata,
        queuePayload.asset.id,
        null,
        dependencies,
        logger,
        "running-record-job-already-exists",
        `Record job skipped because another record job is already running for asset ${queuePayload.asset.id}.`,
      );

      if (!cleanupResult.ok) {
        return cleanupResult;
      }

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

async function cleanupSupersededRecordJobs(
  jobs: Array<{
    createdAt: Date;
    id: string;
    metadata: Record<string, unknown>;
  }>,
  dependencies: HandleRecordingSchedulerJobDependencies,
  logger: Logger,
): Promise<
  Result<
    Array<{
      createdAt: Date;
      id: string;
      metadata: Record<string, unknown>;
    }>,
    Error
  >
> {
  const latestJobByAssetId = new Map<
    string,
    {
      createdAt: Date;
      id: string;
      metadata: Record<string, unknown>;
    }
  >();

  for (const job of jobs) {
    const queuePayload = readRecordContentPayload(job.metadata);
    const assetId = queuePayload?.asset.id;

    if (assetId === undefined) {
      continue;
    }

    const existingJob = latestJobByAssetId.get(assetId);

    if (
      existingJob === undefined ||
      existingJob.createdAt.getTime() <= job.createdAt.getTime()
    ) {
      latestJobByAssetId.set(assetId, job);
    }
  }

  const dedupedJobs = [];

  for (const job of jobs) {
    const queuePayload = readRecordContentPayload(job.metadata);
    const assetId = queuePayload?.asset.id;

    if (assetId === undefined) {
      dedupedJobs.push(job);
      continue;
    }

    const latestJob = latestJobByAssetId.get(assetId);

    if (latestJob?.id === job.id) {
      dedupedJobs.push(job);
      continue;
    }

    const cleanupResult = await cleanupSupersededRecordJob(
      job.id,
      job.metadata,
      assetId,
      latestJob?.id ?? null,
      dependencies,
      logger,
    );

    if (!cleanupResult.ok) {
      return cleanupResult;
    }
  }

  return ok(dedupedJobs);
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
  const cleanupMetadata = withCleanupMetadata(metadata, {
    action: expirationPolicy.action,
    message: expirationPolicy.message,
    reason: expirationPolicy.reason,
  });
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
  cleanup: {
    action: string;
    message: string | null;
    reason: string;
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
        action: cleanup.action,
        cleanedUpAt: new Date().toISOString(),
        message: cleanup.message,
        reason: cleanup.reason,
      },
    },
  };
}

async function cleanupSupersededRecordJob(
  jobId: string,
  metadata: Record<string, unknown>,
  assetId: string,
  supersededByJobId: string | null,
  dependencies: HandleRecordingSchedulerJobDependencies,
  logger: Logger,
  cleanupReason = "superseded-by-newer-record-job",
  failureMessageOverride: string | null = null,
): Promise<Result<void, Error>> {
  const failureMessage =
    failureMessageOverride ??
    (supersededByJobId === null
      ? `Record job superseded by another queued job for asset ${assetId}.`
      : `Record job superseded by queued job ${supersededByJobId} for asset ${assetId}.`);
  const cleanupMetadata = withCleanupMetadata(metadata, {
    action: "mark_failed",
    message: failureMessage,
    reason: cleanupReason,
  });
  const replaceMetadataResult =
    await dependencies.jobRepository.replaceMetadata(jobId, cleanupMetadata);

  if (!replaceMetadataResult.ok) {
    return replaceMetadataResult;
  }

  const markFailedResult = await dependencies.jobRepository.markFailed(
    jobId,
    failureMessage,
    false,
  );

  if (!markFailedResult.ok) {
    return markFailedResult;
  }

  logger.warn("recording scheduler cleaned up superseded record job.", {
    assetId,
    failureMessage,
    supersededByJobId,
    targetJobId: jobId,
  });

  return ok(undefined);
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
