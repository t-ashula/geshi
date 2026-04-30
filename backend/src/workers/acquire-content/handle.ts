import type { JobRepository } from "../../db/job-repository.js";
import type { AcquireContentJobPayload } from "../../job-queue/types.js";
import { contentTypeToExtension } from "../../lib/content-type-extension.js";
import { findLatestFingerprint } from "../../lib/fingerprint.js";
import { sha256ChecksumString } from "../../lib/hash.js";
import type { Result } from "../../lib/result.js";
import { err, ok } from "../../lib/result.js";
import type { Logger } from "../../logger/index.js";
import { getSourceCollectorPlugin } from "../../plugins/index.js";
import type { AcquiredAsset } from "../../plugins/types.js";
import type { AssetService } from "../../service/asset-service.js";
import type { ContentService } from "../../service/content-service.js";
import type { Storage } from "../../storage/types.js";

type HandleAcquireContentJobDependencies = {
  assetService: AssetService;
  contentService: ContentService;
  jobRepository: JobRepository;
  logger: Logger;
  storage: Storage;
};

export async function handleAcquireContentJob(
  payload: AcquireContentJobPayload,
  dependencies: HandleAcquireContentJobDependencies,
): Promise<Result<void, Error>> {
  const logger = dependencies.logger.child({
    assetId: payload.asset.id,
    contentId: payload.content.id,
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
  logger.info("acquire job started.");

  const plugin = getSourceCollectorPlugin(payload.collector.pluginSlug);
  let acquiredAsset;

  try {
    acquiredAsset = await plugin.acquire({
      abortSignal: AbortSignal.timeout(30_000),
      asset: {
        kind: payload.asset.kind,
        observedFingerprints: [payload.asset.observedFingerprint],
        primary: payload.asset.primary,
        sourceUrl: payload.asset.sourceUrl,
      },
      config: payload.collector.config,
      content: payload.content,
      logger: logger.child({
        operation: "acquire",
      }),
    });
  } catch (error) {
    await failAcquireContentJob(payload, dependencies, logger, error);
    return err(
      error instanceof Error ? error : new Error("Acquire content job failed."),
    );
  }

  try {
    const storedAsset = await dependencies.storage.put({
      body: acquiredAsset.body,
      contentType: acquiredAsset.contentType,
      key: createAssetKey(dependencies.storage, payload, acquiredAsset),
      overwrite: true,
    });

    if (!storedAsset.ok) {
      await failAcquireContentJob(
        payload,
        dependencies,
        logger,
        storedAsset.error,
      );
      return storedAsset;
    }

    const upsertStoredAssetResult =
      await dependencies.assetService.upsertStoredAsset({
        acquiredFingerprints: acquiredAsset.acquiredFingerprints,
        acquiredAt: new Date(),
        assetId: payload.asset.id,
        byteSize: storedAsset.value.byteSize,
        checksum: sha256ChecksumString(acquiredAsset.body),
        kind: acquiredAsset.kind,
        mimeType: acquiredAsset.contentType,
        primary: acquiredAsset.primary,
        sourceUrl: acquiredAsset.sourceUrl,
        storageKey: storedAsset.value.key,
      });

    if (!upsertStoredAssetResult.ok) {
      await failAcquireContentJob(
        payload,
        dependencies,
        logger,
        upsertStoredAssetResult.error,
      );
      return upsertStoredAssetResult;
    }

    const markContentStatusResult =
      await dependencies.contentService.markContentStatus(
        payload.content.id,
        "stored",
      );

    if (!markContentStatusResult.ok) {
      await failAcquireContentJob(
        payload,
        dependencies,
        logger,
        markContentStatusResult.error,
      );
      return markContentStatusResult;
    }
    const markSucceededResult = await dependencies.jobRepository.markSucceeded(
      payload.jobId,
    );

    if (!markSucceededResult.ok) {
      return markSucceededResult;
    }
    logger.info("acquire job completed.");
  } catch (error) {
    await failAcquireContentJob(payload, dependencies, logger, error);
    return err(
      error instanceof Error ? error : new Error("Acquire content job failed."),
    );
  }

  return ok(undefined);
}

async function failAcquireContentJob(
  payload: AcquireContentJobPayload,
  dependencies: HandleAcquireContentJobDependencies,
  logger: Logger,
  error: unknown,
): Promise<void> {
  const failureMessage =
    error instanceof Error ? error.message : "Acquire content job failed.";

  const markContentStatusResult =
    await dependencies.contentService.markContentStatus(
      payload.content.id,
      "failed",
    );
  if (!markContentStatusResult.ok) {
    logger.error("acquire job failure could not update content status.", {
      error: markContentStatusResult.error,
      failureMessage,
    });
  }
  const markFailedResult = await dependencies.jobRepository.markFailed(
    payload.jobId,
    failureMessage,
    true,
  );

  if (!markFailedResult.ok) {
    logger.error("acquire job failure could not be persisted.", {
      error: markFailedResult.error,
      failureMessage,
    });
    return;
  }
  logger.error("acquire job failed.", {
    error,
    failureMessage,
  });
}

function createAssetKey(
  storage: Storage,
  payload: AcquireContentJobPayload,
  acquiredAsset: AcquiredAsset,
): string {
  const latestAcquiredFingerprint = findLatestFingerprint(
    acquiredAsset.acquiredFingerprints,
  );

  if (latestAcquiredFingerprint === undefined) {
    throw new Error("Expected at least one acquired asset fingerprint.");
  }

  return storage.pathJoin(
    payload.source.slug,
    payload.content.id,
    acquiredAsset.kind,
    payload.asset.id,
    (payload.content.title ?? "").slice(0, 16),
    `${latestAcquiredFingerprint.replace(":", "-")}${toFileExtension(acquiredAsset.contentType)}`,
  );
}

function toFileExtension(contentType: string | null): string {
  const extension = contentTypeToExtension(contentType);

  return extension === null ? "" : `.${extension}`;
}
