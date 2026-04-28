import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

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
  tmpRootDir?: string;
};

export async function handleObserveSourceJob(
  payload: ObserveSourceJobPayload,
  dependencies: HandleObserveSourceJobDependencies,
): Promise<void> {
  const tmpRootDir = dependencies.tmpRootDir ?? "/tmp/geshi";
  const workDir = join(tmpRootDir, payload.jobId);
  const logger = dependencies.logger.child({
    jobId: payload.jobId,
    pluginSlug: payload.pluginSlug,
    sourceId: payload.sourceId,
  });

  await mkdir(workDir, {
    recursive: true,
  });
  await dependencies.jobRepository.markRunning(payload.jobId);
  logger.info("observe job started.");

  try {
    const plugin = getSourceCollectorPlugin(payload.pluginSlug);
    const abortController = new AbortController();
    const observedContents = await plugin.observe({
      abortSignal: abortController.signal,
      config: payload.config,
      logger: logger.child({
        operation: "observe",
      }),
      sourceUrl: payload.url,
      workDir,
    });

    for (const observedContent of observedContents) {
      const storedContent =
        await dependencies.contentService.createObservedContent({
          contentFingerprints: observedContent.contentFingerprints,
          externalId: observedContent.externalId,
          kind: observedContent.kind,
          publishedAt: observedContent.publishedAt,
          sourceId: payload.sourceId,
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

      for (const assetId of observedAssets.assetIdsRequiringAcquire) {
        const acquireJob = await dependencies.jobRepository.createJob({
          id: uuidv7(),
          kind: ACQUIRE_CONTENT_JOB_NAME,
          retryable: true,
          sourceId: payload.sourceId,
        });
        const queueJobId = await dependencies.jobQueue.enqueue(
          ACQUIRE_CONTENT_JOB_NAME,
          {
            assetId,
            collectorSettingId: payload.collectorSettingId,
            collectorSettingSnapshotId: payload.collectorSettingSnapshotId,
            config: payload.config,
            contentId: storedContent.id,
            jobId: acquireJob.id,
            pluginSlug: payload.pluginSlug,
            sourceId: payload.sourceId,
          },
        );

        await dependencies.jobRepository.attachQueueJobId(
          acquireJob.id,
          queueJobId,
        );
      }
    }
    await dependencies.jobRepository.markSucceeded(payload.jobId);
    logger.info("observe job completed.", {
      observedContentCount: observedContents.length,
    });
  } catch (error) {
    const failureMessage =
      error instanceof Error ? error.message : "Observe source job failed.";

    await dependencies.jobRepository.markFailed(
      payload.jobId,
      failureMessage,
      true,
    );
    logger.error("observe job failed.", {
      error,
      failureMessage,
    });
    throw error;
  } finally {
    await rm(workDir, {
      force: true,
      recursive: true,
    });
  }
}
