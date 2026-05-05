import type { CollectorPluginStateRepository } from "../../db/collector-plugin-state-repository.js";
import type { JobRepository } from "../../db/job-repository.js";
import type { RecordContentJobPayload } from "../../job-queue/types.js";
import { contentTypeToExtension } from "../../lib/content-type-extension.js";
import { findLatestFingerprint } from "../../lib/fingerprint.js";
import { sha256ChecksumString } from "../../lib/hash.js";
import type { Result } from "../../lib/result.js";
import { err, ok } from "../../lib/result.js";
import type { Logger } from "../../logger/index.js";
import type { SourceCollectorRegistry } from "../../plugins/index.js";
import type { JsonObject, RecordedAsset } from "../../plugins/types.js";
import type { AssetService } from "../../service/asset-service.js";
import type { ContentService } from "../../service/content-service.js";
import type { Storage } from "../../storage/types.js";

type HandleRecordContentJobDependencies = {
  assetService: AssetService;
  collectorPluginStateRepository: CollectorPluginStateRepository;
  contentService: ContentService;
  jobRepository: JobRepository;
  logger: Logger;
  sourceCollectorRegistry: SourceCollectorRegistry;
  storage: Storage;
};

export async function handleRecordContentJob(
  payload: RecordContentJobPayload,
  dependencies: HandleRecordContentJobDependencies,
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

  logger.info("record job started.");

  const plugin = dependencies.sourceCollectorRegistry.get(
    payload.collector.pluginSlug,
  );

  if (plugin.record === undefined) {
    const error = new Error(
      `Plugin does not implement record(): ${payload.collector.pluginSlug}`,
    );
    await failRecordContentJob(payload, dependencies, logger, error);
    return err(error);
  }

  const [collectorPluginStateResult, metadataResult] = await Promise.all([
    dependencies.collectorPluginStateRepository.findLatestStateByCollectorSettingId(
      payload.collector.settingId,
    ),
    dependencies.jobRepository.getMetadata(payload.jobId),
  ]);

  if (!collectorPluginStateResult.ok) {
    await failRecordContentJob(
      payload,
      dependencies,
      logger,
      collectorPluginStateResult.error,
    );
    return collectorPluginStateResult;
  }

  if (!metadataResult.ok) {
    await failRecordContentJob(
      payload,
      dependencies,
      logger,
      metadataResult.error,
    );
    return metadataResult;
  }

  const argumentsObject = readPluginArguments(metadataResult.value);
  let recordedAsset;

  try {
    recordedAsset = await plugin.record({
      abortSignal: new AbortController().signal,
      arguments: argumentsObject,
      asset: {
        kind: payload.asset.kind,
        nextAction: {
          actionKind: "record",
          arguments: argumentsObject,
        },
        observedFingerprints: [payload.asset.observedFingerprint],
        primary: payload.asset.primary,
        sourceUrl: payload.asset.sourceUrl,
      },
      collectorPluginState: collectorPluginStateResult.value,
      config: payload.collector.config,
      content: payload.content,
      context: {
        replacePluginMetadata: async (pluginMetadata) => {
          const currentMetadata = await dependencies.jobRepository.getMetadata(
            payload.jobId,
          );

          if (!currentMetadata.ok) {
            throw currentMetadata.error;
          }

          const metadata = currentMetadata.value;
          const currentArguments = readPluginArguments(metadata);
          await dependencies.jobRepository.replaceMetadata(payload.jobId, {
            ...metadata,
            plugin: {
              ...readPluginMetadata(metadata),
              ...pluginMetadata,
              arguments: currentArguments,
            },
          });
        },
      },
      logger: logger.child({
        operation: "record",
      }),
    });
  } catch (error) {
    await failRecordContentJob(payload, dependencies, logger, error);
    return err(
      error instanceof Error ? error : new Error("Record content job failed."),
    );
  }

  try {
    const storedAsset = await dependencies.storage.put({
      body: recordedAsset.body,
      contentType: recordedAsset.contentType,
      key: createAssetKey(dependencies.storage, payload, recordedAsset),
      overwrite: true,
    });

    if (!storedAsset.ok) {
      await failRecordContentJob(
        payload,
        dependencies,
        logger,
        storedAsset.error,
      );
      return storedAsset;
    }

    const upsertStoredAssetResult =
      await dependencies.assetService.upsertStoredAsset({
        acquiredFingerprints: recordedAsset.acquiredFingerprints,
        acquiredAt: new Date(),
        assetId: payload.asset.id,
        byteSize: storedAsset.value.byteSize,
        checksum: sha256ChecksumString(recordedAsset.body),
        kind: recordedAsset.kind,
        mimeType: recordedAsset.contentType,
        primary: recordedAsset.primary,
        sourceUrl: recordedAsset.sourceUrl,
        storageKey: storedAsset.value.key,
      });

    if (!upsertStoredAssetResult.ok) {
      await failRecordContentJob(
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
      await failRecordContentJob(
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

    logger.info("record job completed.");
    return ok(undefined);
  } catch (error) {
    await failRecordContentJob(payload, dependencies, logger, error);
    return err(
      error instanceof Error ? error : new Error("Record content job failed."),
    );
  }
}

async function failRecordContentJob(
  payload: RecordContentJobPayload,
  dependencies: HandleRecordContentJobDependencies,
  logger: Logger,
  error: unknown,
): Promise<void> {
  const failureMessage =
    error instanceof Error ? error.message : "Record content job failed.";

  const markContentStatusResult =
    await dependencies.contentService.markContentStatus(
      payload.content.id,
      "failed",
    );

  if (!markContentStatusResult.ok) {
    logger.error("record job failure could not update content status.", {
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
    logger.error("record job failure could not be persisted.", {
      error: markFailedResult.error,
      failureMessage,
    });
    return;
  }

  logger.error("record job failed.", {
    error,
    failureMessage,
  });
}

function createAssetKey(
  storage: Storage,
  payload: RecordContentJobPayload,
  recordedAsset: RecordedAsset,
): string {
  const latestAcquiredFingerprint = findLatestFingerprint(
    recordedAsset.acquiredFingerprints,
  );

  if (latestAcquiredFingerprint === undefined) {
    throw new Error("Expected at least one recorded asset fingerprint.");
  }

  return storage.pathJoin(
    payload.source.slug,
    payload.content.id,
    recordedAsset.kind,
    payload.asset.id,
    (payload.content.title ?? "").slice(0, 16),
    `${latestAcquiredFingerprint.replace(":", "-")}${toFileExtension(recordedAsset.contentType)}`,
  );
}

function toFileExtension(contentType: string | null): string {
  const extension = contentTypeToExtension(contentType);

  return extension === null ? "" : `.${extension}`;
}

function readPluginArguments(metadata: Record<string, unknown>): JsonObject {
  const pluginMetadata = readPluginMetadata(metadata);
  const argumentsObject = pluginMetadata.arguments;

  if (
    typeof argumentsObject !== "object" ||
    argumentsObject === null ||
    Array.isArray(argumentsObject)
  ) {
    return {};
  }

  return argumentsObject;
}

function readPluginMetadata(metadata: Record<string, unknown>): JsonObject {
  const pluginMetadata = metadata.plugin;

  if (
    typeof pluginMetadata !== "object" ||
    pluginMetadata === null ||
    Array.isArray(pluginMetadata)
  ) {
    return {};
  }

  return pluginMetadata as JsonObject;
}
