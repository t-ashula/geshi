import type { JobRepository } from "../../db/job-repository.js";
import type { AcquireContentJobPayload } from "../../job-queue/types.js";
import { findLatestFingerprint } from "../../lib/fingerprint.js";
import { sha256ChecksumString } from "../../lib/hash.js";
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
): Promise<void> {
  const logger = dependencies.logger.child({
    assetId: payload.asset.id,
    contentId: payload.content.id,
    jobId: payload.jobId,
    pluginSlug: payload.collector.pluginSlug,
    sourceId: payload.source.id,
  });

  await dependencies.jobRepository.markRunning(payload.jobId);
  logger.info("acquire job started.");

  try {
    const plugin = getSourceCollectorPlugin(payload.collector.pluginSlug);

    const acquiredAsset = await plugin.acquire({
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
    const storedAsset = await dependencies.storage.put({
      body: acquiredAsset.body,
      contentType: acquiredAsset.contentType,
      key: createAssetKey(dependencies.storage, payload, acquiredAsset),
      overwrite: true,
    });

    await dependencies.assetService.upsertStoredAsset({
      acquiredFingerprints: acquiredAsset.acquiredFingerprints,
      acquiredAt: new Date(),
      assetId: payload.asset.id,
      byteSize: storedAsset.byteSize,
      checksum: sha256ChecksumString(acquiredAsset.body),
      kind: acquiredAsset.kind,
      mimeType: acquiredAsset.contentType,
      primary: acquiredAsset.primary,
      sourceUrl: acquiredAsset.sourceUrl,
      storageKey: storedAsset.key,
    });

    await dependencies.contentService.markContentStatus(
      payload.content.id,
      "stored",
    );
    await dependencies.jobRepository.markSucceeded(payload.jobId);
    logger.info("acquire job completed.");
  } catch (error) {
    const failureMessage =
      error instanceof Error ? error.message : "Acquire content job failed.";

    await dependencies.contentService.markContentStatus(
      payload.content.id,
      "failed",
    );
    await dependencies.jobRepository.markFailed(
      payload.jobId,
      failureMessage,
      true,
    );
    logger.error("acquire job failed.", {
      error,
      failureMessage,
    });
    throw error;
  }
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
    `${latestAcquiredFingerprint.replace(":", "-")}${contentTypeToExtension(acquiredAsset.contentType)}`,
  );
}

function contentTypeToExtension(contentType: string | null): string {
  switch (contentType) {
    case "audio/aac":
      return ".aac";
    case "audio/flac":
      return ".flac";
    case "audio/mp4":
    case "audio/x-m4a":
      return ".m4a";
    case "audio/mpeg":
      return ".mp3";
    case "audio/ogg":
      return ".ogg";
    case "audio/wav":
    case "audio/x-wav":
      return ".wav";
    case "text/html":
      return ".html";
    default:
      return "";
  }
}
