import { v7 as uuidv7 } from "uuid";

import type { JobRepository } from "../../db/job-repository.js";
import type {
  JobQueue,
  ObserveSourceJobPayload,
} from "../../job-queue/types.js";
import { ACQUIRE_CONTENT_JOB_NAME } from "../../job-queue/types.js";
import type { Logger } from "../../logger/index.js";
import { getSourceCollectorPlugin } from "../../plugins/index.js";
import type { AssetService } from "../../service/asset-service.js";
import type { ContentService } from "../../service/content-service.js";

type HandleObserveSourceJobDependencies = {
  assetService: AssetService;
  contentService: ContentService;
  jobQueue: JobQueue;
  jobRepository: JobRepository;
  logger: Logger;
};

export async function handleObserveSourceJob(
  payload: ObserveSourceJobPayload,
  dependencies: HandleObserveSourceJobDependencies,
): Promise<void> {
  const logger = dependencies.logger.child({
    jobId: payload.jobId,
    pluginSlug: payload.collector.pluginSlug,
    sourceId: payload.source.id,
  });

  await dependencies.jobRepository.markRunning(payload.jobId);
  logger.info("observe job started.");

  const plugin = getSourceCollectorPlugin(payload.collector.pluginSlug);
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
    throw error;
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

      const observedAssets =
        await dependencies.assetService.createObservedAssets(
          observedContent.assets.map((asset) => ({
            contentFingerprintChanged: storedContent.fingerprintChanged,
            contentId: storedContent.id,
            kind: asset.kind,
            observedFingerprints: asset.observedFingerprints,
            primary: asset.primary,
            sourceUrl: asset.sourceUrl,
          })),
        );
      const observedAssetByFingerprint = new Map(
        observedContent.assets.map((asset) => [
          asset.observedFingerprints[0],
          asset,
        ]),
      );

      for (const assetId of observedAssets.assetIdsRequiringAcquire) {
        const persistedAsset =
          await dependencies.assetService.findAcquireTargetById(assetId);

        if (persistedAsset === null) {
          throw new Error(`Pending asset not found after observe: ${assetId}`);
        }

        const observedAsset = observedAssetByFingerprint.get(
          persistedAsset.observedFingerprint,
        );

        if (observedAsset === undefined) {
          throw new Error(
            `Observed asset metadata not found for fingerprint: ${persistedAsset.observedFingerprint}`,
          );
        }

        const acquireJob = await dependencies.jobRepository.createJob({
          id: uuidv7(),
          kind: ACQUIRE_CONTENT_JOB_NAME,
          retryable: true,
          sourceId: payload.source.id,
        });
        const queueJobId = await dependencies.jobQueue.enqueue(
          ACQUIRE_CONTENT_JOB_NAME,
          {
            asset: {
              id: assetId,
              kind: observedAsset.kind,
              observedFingerprint: persistedAsset.observedFingerprint,
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
              id: storedContent.id,
              kind: observedContent.kind,
              publishedAt: observedContent.publishedAt,
              status: observedContent.status,
              summary: observedContent.summary,
              title: observedContent.title,
            },
            jobId: acquireJob.id,
            source: {
              id: payload.source.id,
              slug: payload.source.slug,
            },
          },
        );

        await dependencies.jobRepository.attachQueueJobId(
          acquireJob.id,
          queueJobId,
        );
      }
    }
  } catch (error) {
    await failObserveSourceJob(payload.jobId, dependencies, logger, error);
    throw error;
  }

  await dependencies.jobRepository.markSucceeded(payload.jobId);
  logger.info("observe job completed.", {
    observedContentCount: observedContents.length,
  });
}

async function failObserveSourceJob(
  jobId: string,
  dependencies: HandleObserveSourceJobDependencies,
  logger: Logger,
  error: unknown,
): Promise<void> {
  const failureMessage =
    error instanceof Error ? error.message : "Observe source job failed.";

  await dependencies.jobRepository.markFailed(jobId, failureMessage, true);
  logger.error("observe job failed.", {
    error,
    failureMessage,
  });
}
