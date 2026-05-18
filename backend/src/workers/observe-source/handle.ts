import { v7 as uuidv7 } from "uuid";

import type { CreateObservedAssetsResult } from "../../db/asset-repository.js";
import type { CollectorPluginStateRepository } from "../../db/collector-plugin-state-repository.js";
import type { JobRepository } from "../../db/job-repository.js";
import type { PluginGlobalRuntimeStateRepository } from "../../db/plugin-global-runtime-state-repository.js";
import type {
  AcquireContentJobPayload,
  JobQueue,
  ObserveSourceJobPayload,
  RecordContentJobPayload,
} from "../../job-queue/types.js";
import {
  ACQUIRE_CONTENT_JOB_NAME,
  RECORD_CONTENT_JOB_NAME,
} from "../../job-queue/types.js";
import { findLatestFingerprint } from "../../lib/fingerprint.js";
import type { Result } from "../../lib/result.js";
import { err, ok } from "../../lib/result.js";
import type { Logger } from "../../logger/index.js";
import type { SourceCollectorRegistry } from "../../plugins/index.js";
import { createPluginGlobalRuntimeStateHost } from "../../plugins/plugin-global-runtime-state-host.js";
import type { ObservedAsset, ObservedContent } from "../../plugins/types.js";
import type { AssetService } from "../../service/asset-service.js";
import type { ContentService } from "../../service/content-service.js";

type HandleObserveSourceJobDependencies = {
  assetService: AssetService;
  collectorPluginStateRepository: CollectorPluginStateRepository;
  contentService: ContentService;
  jobQueue: JobQueue;
  jobRepository: JobRepository;
  logger: Logger;
  pluginGlobalRuntimeStateRepository: PluginGlobalRuntimeStateRepository;
  sourceCollectorRegistry: SourceCollectorRegistry;
};

type StoredObservedContent = {
  externalId: string;
  fingerprintChanged: boolean;
  id: string;
  kind: string;
  publishedAt: Date | null;
  status: "discovered" | "stored" | "failed";
  summary: string | null;
  title: string | null;
};

type ObserveFollowUpContext = {
  observedAssetByFingerprint: Map<string, ObservedAsset>;
  queuedOrRunningRecordAssetIds: Set<string>;
};

export async function handleObserveSourceJob(
  payload: ObserveSourceJobPayload,
  dependencies: HandleObserveSourceJobDependencies,
): Promise<Result<void, Error>> {
  const logger = dependencies.logger.child({
    jobId: payload.jobId,
    pluginSlug: payload.collector.pluginSlug,
    sourceId: payload.source.id,
  });

  const markRunningResult = await dependencies.jobRepository.markRunning(
    payload.jobId,
  );

  if (!markRunningResult.ok) {
    return markRunningResult;
  }
  logger.info("observe job started.");

  const plugin = dependencies.sourceCollectorRegistry.get(
    payload.collector.pluginSlug,
  );
  const collectorPluginStateResult =
    await dependencies.collectorPluginStateRepository.findLatestStateByCollectorSettingId(
      payload.collector.settingId,
    );

  if (!collectorPluginStateResult.ok) {
    await failObserveSourceJob(
      payload.jobId,
      dependencies,
      logger,
      collectorPluginStateResult.error,
    );
    return collectorPluginStateResult;
  }

  let observeResult;

  try {
    const pluginLogger = logger.child({
      operation: "observe",
    });
    observeResult = await plugin.observe(
      {
        abortSignal: AbortSignal.timeout(30_000),
        collectorPluginState: collectorPluginStateResult.value,
        config: payload.collector.config,
        sourceUrl: payload.source.url,
      },
      {
        getHost() {
          return {
            logger: pluginLogger,
            pluginGlobalRuntimeState: createPluginGlobalRuntimeStateHost(
              dependencies.pluginGlobalRuntimeStateRepository,
              payload.collector.pluginSlug,
            ),
          };
        },
      },
    );
  } catch (error) {
    await failObserveSourceJob(payload.jobId, dependencies, logger, error);
    return err(
      error instanceof Error ? error : new Error("Observe source job failed."),
    );
  }

  const queuedOrRunningRecordAssetIdsResult =
    await dependencies.jobRepository.listIncompleteRecordContentAssetIds();

  if (!queuedOrRunningRecordAssetIdsResult.ok) {
    await failObserveSourceJob(
      payload.jobId,
      dependencies,
      logger,
      queuedOrRunningRecordAssetIdsResult.error,
    );
    return queuedOrRunningRecordAssetIdsResult;
  }

  const followUpContext: ObserveFollowUpContext = {
    observedAssetByFingerprint: new Map(),
    queuedOrRunningRecordAssetIds: queuedOrRunningRecordAssetIdsResult.value,
  };

  for (const observedContent of observeResult.contents) {
    const processObservedContentResult = await processObservedContent(
      observedContent,
      payload,
      dependencies,
      followUpContext,
    );

    if (!processObservedContentResult.ok) {
      await failObserveSourceJob(
        payload.jobId,
        dependencies,
        logger,
        processObservedContentResult.error,
      );
      return processObservedContentResult;
    }
  }

  if (observeResult.collectorPluginState !== undefined) {
    const saveCollectorPluginStateResult =
      await dependencies.collectorPluginStateRepository.saveState({
        collectorSettingId: payload.collector.settingId,
        pluginSlug: payload.collector.pluginSlug,
        state: observeResult.collectorPluginState,
      });

    if (!saveCollectorPluginStateResult.ok) {
      await failObserveSourceJob(
        payload.jobId,
        dependencies,
        logger,
        saveCollectorPluginStateResult.error,
      );
      return saveCollectorPluginStateResult;
    }
  }

  const markSucceededResult = await dependencies.jobRepository.markSucceeded(
    payload.jobId,
  );

  if (!markSucceededResult.ok) {
    return markSucceededResult;
  }
  logger.info("observe job completed.", {
    observedContentCount: observeResult.contents.length,
  });

  return ok(undefined);
}

async function processObservedContent(
  observedContent: ObservedContent,
  payload: ObserveSourceJobPayload,
  dependencies: HandleObserveSourceJobDependencies,
  followUpContext: ObserveFollowUpContext,
): Promise<Result<void, Error>> {
  const storedContentResult = await storeObservedContent(
    observedContent,
    payload,
    dependencies,
  );

  if (!storedContentResult.ok) {
    return storedContentResult;
  }

  const storedAssetsResult = await storeObservedAssets(
    observedContent,
    storedContentResult.value,
    dependencies,
  );

  if (!storedAssetsResult.ok) {
    return storedAssetsResult;
  }

  indexObservedAssetsByFingerprint(
    observedContent.assets,
    followUpContext.observedAssetByFingerprint,
  );

  return enqueueFollowUpJobs(
    observedContent,
    storedContentResult.value,
    storedAssetsResult.value,
    payload,
    dependencies,
    followUpContext,
  );
}

async function storeObservedContent(
  observedContent: ObservedContent,
  payload: ObserveSourceJobPayload,
  dependencies: HandleObserveSourceJobDependencies,
): Promise<Result<StoredObservedContent, Error>> {
  const storedContentResult =
    await dependencies.contentService.createObservedContent({
      contentFingerprints: observedContent.contentFingerprints,
      externalId: observedContent.externalId,
      kind: observedContent.kind,
      publishedAt: observedContent.publishedAt,
      sourceId: payload.source.id,
      status: "discovered",
      summary: observedContent.summary,
      title: observedContent.title,
    });

  if (!storedContentResult.ok) {
    return storedContentResult;
  }

  return ok({
    externalId: observedContent.externalId,
    fingerprintChanged: storedContentResult.value.fingerprintChanged,
    id: storedContentResult.value.id,
    kind: observedContent.kind,
    publishedAt: observedContent.publishedAt,
    status: observedContent.status,
    summary: observedContent.summary,
    title: observedContent.title,
  });
}

async function storeObservedAssets(
  observedContent: ObservedContent,
  storedContent: StoredObservedContent,
  dependencies: HandleObserveSourceJobDependencies,
): Promise<Result<CreateObservedAssetsResult, Error>> {
  return dependencies.assetService.createObservedAssets(
    observedContent.assets.map((asset) => ({
      contentFingerprintChanged: storedContent.fingerprintChanged,
      contentId: storedContent.id,
      kind: asset.kind,
      observedFingerprints: asset.observedFingerprints,
      primary: asset.primary,
      sourceUrl: asset.sourceUrl,
    })),
  );
}

function indexObservedAssetsByFingerprint(
  observedAssets: ObservedAsset[],
  observedAssetByFingerprint: Map<string, ObservedAsset>,
): void {
  for (const observedAsset of observedAssets) {
    const latestObservedFingerprint = findLatestFingerprint(
      observedAsset.observedFingerprints,
    );

    if (latestObservedFingerprint === undefined) {
      continue;
    }

    observedAssetByFingerprint.set(latestObservedFingerprint, observedAsset);
  }
}

async function enqueueFollowUpJobs(
  observedContent: ObservedContent,
  storedContent: StoredObservedContent,
  observedAssets: CreateObservedAssetsResult,
  payload: ObserveSourceJobPayload,
  dependencies: HandleObserveSourceJobDependencies,
  followUpContext: ObserveFollowUpContext,
): Promise<Result<void, Error>> {
  for (const assetId of observedAssets.assetIdsRequiringAcquire) {
    const persistedAsset =
      await dependencies.assetService.findAcquireTargetById(assetId);

    if (!persistedAsset.ok) {
      return err(new Error(persistedAsset.error.message));
    }

    const observedAsset = followUpContext.observedAssetByFingerprint.get(
      persistedAsset.value.observedFingerprint,
    );

    if (observedAsset === undefined) {
      return err(
        new Error(
          `Observed asset metadata not found for fingerprint: ${persistedAsset.value.observedFingerprint}`,
        ),
      );
    }

    if (observedAsset.nextAction.actionKind === "none") {
      continue;
    }

    if (observedAsset.nextAction.actionKind === "record") {
      const enqueueRecordJobResult = await enqueueRecordJob(
        assetId,
        observedAsset,
        persistedAsset.value.observedFingerprint,
        storedContent,
        payload,
        dependencies,
        followUpContext.queuedOrRunningRecordAssetIds,
      );

      if (!enqueueRecordJobResult.ok) {
        return enqueueRecordJobResult;
      }

      continue;
    }

    const enqueueAcquireJobResult = await enqueueAcquireJob(
      assetId,
      observedAsset,
      persistedAsset.value.observedFingerprint,
      storedContent,
      payload,
      dependencies,
    );

    if (!enqueueAcquireJobResult.ok) {
      return enqueueAcquireJobResult;
    }
  }

  return ok(undefined);
}

async function enqueueRecordJob(
  assetId: string,
  observedAsset: ObservedAsset,
  observedFingerprint: string,
  storedContent: StoredObservedContent,
  payload: ObserveSourceJobPayload,
  dependencies: HandleObserveSourceJobDependencies,
  queuedOrRunningRecordAssetIds: Set<string>,
): Promise<Result<void, Error>> {
  if (queuedOrRunningRecordAssetIds.has(assetId)) {
    return ok(undefined);
  }

  if (observedAsset.nextAction.actionKind !== "record") {
    return err(new Error("Expected record next-action policy."));
  }

  const recordNextAction = observedAsset.nextAction;
  const recordJobId = uuidv7();
  const recordPayload: RecordContentJobPayload = {
    asset: {
      id: assetId,
      kind: observedAsset.kind,
      observedFingerprint,
      primary: observedAsset.primary,
      sourceUrl: observedAsset.sourceUrl,
    },
    collector: {
      config: payload.collector.config,
      pluginSlug: payload.collector.pluginSlug,
      settingId: payload.collector.settingId,
      settingSnapshotId: payload.collector.settingSnapshotId,
    },
    content: {
      externalId: storedContent.externalId,
      id: storedContent.id,
      kind: storedContent.kind,
      publishedAt: storedContent.publishedAt,
      status: storedContent.status,
      summary: storedContent.summary,
      title: storedContent.title,
    },
    jobId: recordJobId,
    source: {
      id: payload.source.id,
      slug: payload.source.slug,
    },
  };

  const recordJob = await dependencies.jobRepository.createJob({
    id: recordJobId,
    kind: RECORD_CONTENT_JOB_NAME,
    metadata: {
      core: {
        actionKind: "record",
        expirationPolicy:
          recordNextAction.expirationPolicy === undefined
            ? null
            : {
                action: recordNextAction.expirationPolicy.action,
                message: recordNextAction.expirationPolicy.message ?? null,
                reason: recordNextAction.expirationPolicy.reason,
              },
        latestRunnableAt:
          recordNextAction.latestRunnableAt?.toISOString() ?? null,
        scheduledStartAt:
          recordNextAction.scheduledStartAt?.toISOString() ?? null,
      },
      plugin: {
        arguments: recordNextAction.arguments ?? {},
      },
    },
    payload: recordPayload,
    retryable: true,
  });

  if (!recordJob.ok) {
    return recordJob;
  }

  queuedOrRunningRecordAssetIds.add(assetId);
  return ok(undefined);
}

async function enqueueAcquireJob(
  assetId: string,
  observedAsset: ObservedAsset,
  observedFingerprint: string,
  storedContent: StoredObservedContent,
  payload: ObserveSourceJobPayload,
  dependencies: HandleObserveSourceJobDependencies,
): Promise<Result<void, Error>> {
  const acquireJobId = uuidv7();
  const acquirePayload: AcquireContentJobPayload = {
    asset: {
      id: assetId,
      kind: observedAsset.kind,
      observedFingerprint,
      primary: observedAsset.primary,
      sourceUrl: observedAsset.sourceUrl,
    },
    collector: {
      config: payload.collector.config,
      pluginSlug: payload.collector.pluginSlug,
      settingId: payload.collector.settingId,
      settingSnapshotId: payload.collector.settingSnapshotId,
    },
    content: {
      externalId: storedContent.externalId,
      id: storedContent.id,
      kind: storedContent.kind,
      publishedAt: storedContent.publishedAt,
      status: storedContent.status,
      summary: storedContent.summary,
      title: storedContent.title,
    },
    jobId: acquireJobId,
    source: {
      id: payload.source.id,
      slug: payload.source.slug,
    },
  };

  const acquireJob = await dependencies.jobRepository.createJob({
    id: acquireJobId,
    kind: ACQUIRE_CONTENT_JOB_NAME,
    payload: acquirePayload,
    retryable: true,
  });

  if (!acquireJob.ok) {
    return acquireJob;
  }

  const queueJobId = await dependencies.jobQueue.enqueue(
    ACQUIRE_CONTENT_JOB_NAME,
    acquirePayload,
  );

  const attachQueueJobIdResult =
    await dependencies.jobRepository.attachQueueJobId(
      acquireJob.value.id,
      queueJobId,
    );

  if (!attachQueueJobIdResult.ok) {
    return attachQueueJobIdResult;
  }

  return ok(undefined);
}

async function failObserveSourceJob(
  jobId: string,
  dependencies: HandleObserveSourceJobDependencies,
  logger: Logger,
  error: unknown,
): Promise<void> {
  const failureMessage =
    error instanceof Error ? error.message : "Observe source job failed.";

  const markFailedResult = await dependencies.jobRepository.markFailed(
    jobId,
    failureMessage,
    true,
  );

  if (!markFailedResult.ok) {
    logger.error("observe job failure could not be persisted.", {
      error: markFailedResult.error,
      failureMessage,
    });
    return;
  }
  logger.error("observe job failed.", {
    error,
    failureMessage,
  });
}
