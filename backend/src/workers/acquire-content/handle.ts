import type { JobRepository } from "../../db/job-repository.js";
import type { AcquireContentJobPayload } from "../../job-queue/types.js";
import { contentTypeToExtension } from "../../lib/content-type-extension.js";
import { findLatestFingerprint } from "../../lib/fingerprint.js";
import { sha256ChecksumString } from "../../lib/hash.js";
import type { Result } from "../../lib/result.js";
import { err, ok } from "../../lib/result.js";
import type { Logger } from "../../logger/index.js";
import type { SourceCollectorRegistry } from "../../plugins/index.js";
import type { AcquiredAsset } from "../../plugins/types.js";
import type { AssetService } from "../../service/asset-service.js";
import type { ContentService } from "../../service/content-service.js";
import type { Storage } from "../../storage/types.js";

type HandleAcquireContentJobDependencies = {
  assetService: AssetService;
  contentService: ContentService;
  jobRepository: JobRepository;
  logger: Logger;
  sourceCollectorRegistry: SourceCollectorRegistry;
  storage: Storage;
  workStorage: Storage;
};

export async function handleAcquireContentJob(
  payload: AcquireContentJobPayload,
  dependencies: HandleAcquireContentJobDependencies,
): Promise<Result<void, Error>> {
  const logger = dependencies.logger.child({
    assetId: payload.asset.id,
    assetKind: payload.asset.kind,
    assetSourceUrl: payload.asset.sourceUrl,
    contentId: payload.content.id,
    jobId: payload.jobId,
    pluginSlug: payload.collector.pluginSlug,
    sourceId: payload.source.id,
    sourceSlug: payload.source.slug,
  });

  const markRunningResult = await dependencies.jobRepository.markRunning(
    payload.jobId,
  );

  if (!markRunningResult.ok) {
    return markRunningResult;
  }
  logger.info("acquire job started.");

  const plugin = dependencies.sourceCollectorRegistry.get(
    payload.collector.pluginSlug,
  );
  let acquiredAsset;

  try {
    acquiredAsset = await plugin.acquire({
      abortSignal: AbortSignal.timeout(30_000),
      asset: {
        kind: payload.asset.kind,
        nextAction: {
          actionKind: "acquire",
        },
        observedFingerprints: [payload.asset.observedFingerprint],
        primary: payload.asset.primary,
        sourceUrl: payload.asset.sourceUrl,
      },
      config: payload.collector.config,
      content: payload.content,
      context: {
        putWorkObject: async (input) => {
          const storedWorkObject = await dependencies.workStorage.put({
            body: input.body,
            contentType: null,
            key: createWorkStorageKey(dependencies.workStorage, payload),
            overwrite: input.overwrite,
          });

          if (!storedWorkObject.ok) {
            throw storedWorkObject.error;
          }

          return storedWorkObject.value;
        },
      },
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
    const acquiredAssetPayload = validateAcquiredAssetPayload(acquiredAsset);

    if (!acquiredAssetPayload.ok) {
      await failAcquireContentJob(
        payload,
        dependencies,
        logger,
        acquiredAssetPayload.error,
      );
      return acquiredAssetPayload;
    }

    const assetKey = createAssetKey(
      dependencies.storage,
      payload,
      acquiredAsset,
    );
    const storedAsset =
      acquiredAssetPayload.value.kind === "work-storage-key"
        ? await storeAcquiredAssetFromWorkStorage(
            dependencies,
            acquiredAssetPayload.value.workStorageKey,
            acquiredAsset.contentType,
            assetKey,
          )
        : await dependencies.storage.put({
            body: acquiredAssetPayload.value.body,
            contentType: acquiredAsset.contentType,
            key: assetKey,
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

    if (acquiredAssetPayload.value.kind === "work-storage-key") {
      const deleteWorkFileResult = await dependencies.workStorage.delete(
        acquiredAssetPayload.value.workStorageKey,
      );

      if (!deleteWorkFileResult.ok) {
        logger.warn("acquire job work storage cleanup failed.", {
          error: deleteWorkFileResult.error.message,
          workStorageKey: acquiredAssetPayload.value.workStorageKey,
        });
      }
    }

    const upsertStoredAssetResult =
      await dependencies.assetService.upsertStoredAsset({
        acquiredFingerprints: acquiredAsset.acquiredFingerprints,
        acquiredAt: new Date(),
        assetId: payload.asset.id,
        byteSize: storedAsset.value.byteSize,
        checksum:
          acquiredAssetPayload.value.kind === "body"
            ? sha256ChecksumString(acquiredAssetPayload.value.body)
            : null,
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

async function storeAcquiredAssetFromWorkStorage(
  dependencies: HandleAcquireContentJobDependencies,
  workStorageKey: string,
  contentType: string | null,
  storageKey: string,
): Promise<
  Result<{ byteSize: number; contentType: string | null; key: string }, Error>
> {
  const workStorageBody = await dependencies.workStorage.get(workStorageKey);

  if (!workStorageBody.ok) {
    return workStorageBody;
  }

  return dependencies.storage.put({
    body: workStorageBody.value,
    contentType,
    key: storageKey,
    overwrite: true,
  });
}

function validateAcquiredAssetPayload(
  acquiredAsset: AcquiredAsset,
): Result<
  | { kind: "body"; body: Uint8Array }
  | { kind: "work-storage-key"; workStorageKey: string },
  Error
> {
  const hasBody = acquiredAsset.body !== undefined;
  const hasWorkStorageKey = acquiredAsset.workStorageKey !== undefined;

  if (hasBody === hasWorkStorageKey) {
    return err(
      new Error(
        "Acquired asset must provide exactly one of body or workStorageKey.",
      ),
    );
  }

  return hasBody
    ? ok({
        body: acquiredAsset.body,
        kind: "body",
      })
    : ok({
        kind: "work-storage-key",
        workStorageKey: acquiredAsset.workStorageKey,
      });
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

function createWorkStorageKey(
  storage: Storage,
  payload: AcquireContentJobPayload,
): string {
  return storage.pathJoin(
    payload.source.slug,
    payload.content.id,
    payload.asset.id,
    payload.jobId,
    "object.bin",
  );
}

function toFileExtension(contentType: string | null): string {
  const extension = contentTypeToExtension(contentType);

  return extension === null ? "" : `.${extension}`;
}
