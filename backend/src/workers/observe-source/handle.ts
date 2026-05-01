import { v7 as uuidv7 } from "uuid";

import type { JobRepository } from "../../db/job-repository.js";
import type {
  JobQueue,
  ObserveSourceJobPayload,
} from "../../job-queue/types.js";
import { ACQUIRE_CONTENT_JOB_NAME } from "../../job-queue/types.js";
import type { Result } from "../../lib/result.js";
import { err, ok } from "../../lib/result.js";
import type { Logger } from "../../logger/index.js";
import type { SourceCollectorRegistry } from "../../plugins/index.js";
import type { AssetService } from "../../service/asset-service.js";
import type { ContentService } from "../../service/content-service.js";

type HandleObserveSourceJobDependencies = {
  assetService: AssetService;
  contentService: ContentService;
  jobQueue: JobQueue;
  jobRepository: JobRepository;
  logger: Logger;
  sourceCollectorRegistry: SourceCollectorRegistry;
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
  const abortController = new AbortController();
  let observedContents;

  try {
    observedContents = await plugin.observe({
      abortSignal: abortController.signal,
      config: payload.collector.config,
      logger: logger.child({
        operation: "observe",
      }),
      sourceUrl: payload.source.url,
    });
  } catch (error) {
    await failObserveSourceJob(payload.jobId, dependencies, logger, error);
    return err(
      error instanceof Error ? error : new Error("Observe source job failed."),
    );
  }

  try {
    for (const observedContent of observedContents) {
      const storedContent =
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

      if (!storedContent.ok) {
        await failObserveSourceJob(
          payload.jobId,
          dependencies,
          logger,
          storedContent.error,
        );
        return storedContent;
      }

      const observedAssets =
        await dependencies.assetService.createObservedAssets(
          observedContent.assets.map((asset) => ({
            contentFingerprintChanged: storedContent.value.fingerprintChanged,
            contentId: storedContent.value.id,
            kind: asset.kind,
            observedFingerprints: asset.observedFingerprints,
            primary: asset.primary,
            sourceUrl: asset.sourceUrl,
          })),
        );

      if (!observedAssets.ok) {
        await failObserveSourceJob(
          payload.jobId,
          dependencies,
          logger,
          observedAssets.error,
        );
        return observedAssets;
      }

      const observedAssetByFingerprint = new Map(
        observedContent.assets.map((asset) => [
          asset.observedFingerprints[0],
          asset,
        ]),
      );

      for (const assetId of observedAssets.value.assetIdsRequiringAcquire) {
        const persistedAsset =
          await dependencies.assetService.findAcquireTargetById(assetId);

        if (!persistedAsset.ok) {
          await failObserveSourceJob(
            payload.jobId,
            dependencies,
            logger,
            new Error(persistedAsset.error.message),
          );
          return err(new Error(persistedAsset.error.message));
        }

        const observedAsset = observedAssetByFingerprint.get(
          persistedAsset.value.observedFingerprint,
        );

        if (observedAsset === undefined) {
          const error = new Error(
            `Observed asset metadata not found for fingerprint: ${persistedAsset.value.observedFingerprint}`,
          );
          await failObserveSourceJob(
            payload.jobId,
            dependencies,
            logger,
            error,
          );
          return err(error);
        }

        const acquireJob = await dependencies.jobRepository.createJob({
          id: uuidv7(),
          kind: ACQUIRE_CONTENT_JOB_NAME,
          retryable: true,
          sourceId: payload.source.id,
        });
        if (!acquireJob.ok) {
          await failObserveSourceJob(
            payload.jobId,
            dependencies,
            logger,
            acquireJob.error,
          );
          return acquireJob;
        }
        const queueJobId = await dependencies.jobQueue.enqueue(
          ACQUIRE_CONTENT_JOB_NAME,
          {
            asset: {
              id: assetId,
              kind: observedAsset.kind,
              observedFingerprint: persistedAsset.value.observedFingerprint,
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
              externalId: observedContent.externalId,
              id: storedContent.value.id,
              kind: observedContent.kind,
              publishedAt: observedContent.publishedAt,
              status: observedContent.status,
              summary: observedContent.summary,
              title: observedContent.title,
            },
            jobId: acquireJob.value.id,
            source: {
              id: payload.source.id,
              slug: payload.source.slug,
            },
          },
        );

        const attachQueueJobIdResult =
          await dependencies.jobRepository.attachQueueJobId(
            acquireJob.value.id,
            queueJobId,
          );

        if (!attachQueueJobIdResult.ok) {
          await failObserveSourceJob(
            payload.jobId,
            dependencies,
            logger,
            attachQueueJobIdResult.error,
          );
          return attachQueueJobIdResult;
        }
      }
    }
  } catch (error) {
    await failObserveSourceJob(payload.jobId, dependencies, logger, error);
    return err(
      error instanceof Error ? error : new Error("Observe source job failed."),
    );
  }

  const markSucceededResult = await dependencies.jobRepository.markSucceeded(
    payload.jobId,
  );

  if (!markSucceededResult.ok) {
    return markSucceededResult;
  }
  logger.info("observe job completed.", {
    observedContentCount: observedContents.length,
  });

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
