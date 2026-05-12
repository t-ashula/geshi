import type {
  DetailBodyRecord,
  DetailBodyRepository,
} from "../db/detail-body-repository.js";
import type { Result } from "../lib/result.js";
import { ok } from "../lib/result.js";
import type { Logger } from "../logger/index.js";
import type { SourceCollectorRegistry } from "../plugins/index.js";
import { defaultSourceCollectorRegistry } from "../plugins/index.js";
import type { GetWebClientInput, PluginWebClient } from "../plugins/types.js";
import type { Storage } from "../storage/types.js";

export interface DetailBodyService {
  findOrCreateDetailBodyByContentId(
    contentId: string,
  ): Promise<Result<DetailBodyRecord | null, Error>>;
}

export type CreateDetailBodyServiceDependencies = {
  getWebClient: (
    input: GetWebClientInput,
    logger: Logger,
  ) => Promise<PluginWebClient>;
  logger: Logger;
  sourceCollectorRegistry?: SourceCollectorRegistry;
};

export function createDetailBodyService(
  detailBodyRepository: DetailBodyRepository,
  storage: Storage,
  dependencies: CreateDetailBodyServiceDependencies,
): DetailBodyService {
  const getWebClient = dependencies.getWebClient;
  const logger = dependencies.logger;
  const sourceCollectorRegistry =
    dependencies.sourceCollectorRegistry ?? defaultSourceCollectorRegistry;

  return {
    async findOrCreateDetailBodyByContentId(
      contentId: string,
    ): Promise<Result<DetailBodyRecord | null, Error>> {
      logger.info("detail body resolution started.", {
        contentId,
      });

      const existingDetailBody =
        await detailBodyRepository.findDetailBodyByContentId(contentId);

      if (!existingDetailBody.ok) {
        logger.warn("detail body lookup failed.", {
          contentId,
          error: existingDetailBody.error.message,
        });
        return existingDetailBody;
      }

      if (existingDetailBody.value !== null) {
        logger.info("detail body found from content cache.", {
          contentId,
          detailBodyId: existingDetailBody.value.id,
        });
        return existingDetailBody;
      }

      const target =
        await detailBodyRepository.findHtmlDetailBodyTargetByContentId(
          contentId,
        );

      if (!target.ok) {
        logger.warn("detail body target lookup failed.", {
          contentId,
          error: target.error.message,
        });
        return target;
      }

      if (target.value === null) {
        logger.info("detail body target not found.", {
          contentId,
        });
        return ok(null);
      }

      const alreadyGenerated =
        await detailBodyRepository.findDetailBodyByAssetSnapshotId(
          target.value.sourceAssetSnapshotId,
        );

      if (!alreadyGenerated.ok) {
        logger.warn("detail body asset snapshot lookup failed.", {
          contentId,
          error: alreadyGenerated.error.message,
          sourceAssetSnapshotId: target.value.sourceAssetSnapshotId,
        });
        return alreadyGenerated;
      }

      if (alreadyGenerated.value !== null) {
        logger.info("detail body found from asset snapshot cache.", {
          contentId,
          detailBodyId: alreadyGenerated.value.id,
          sourceAssetSnapshotId: target.value.sourceAssetSnapshotId,
        });
        return alreadyGenerated;
      }

      let plugin;

      try {
        plugin = sourceCollectorRegistry.get(target.value.pluginSlug);
      } catch (error) {
        logger.warn("detail body plugin load failed.", {
          contentId: target.value.contentId,
          error: error instanceof Error ? error.message : String(error),
          pluginSlug: target.value.pluginSlug,
          sourceAssetSnapshotId: target.value.sourceAssetSnapshotId,
        });
        return ok(null);
      }

      if (typeof plugin.extract !== "function") {
        logger.info("detail body extract unsupported by plugin.", {
          contentId: target.value.contentId,
          pluginSlug: target.value.pluginSlug,
          sourceAssetSnapshotId: target.value.sourceAssetSnapshotId,
        });
        return ok(null);
      }

      const storedHtml = await storage.get(target.value.storageKey);

      if (!storedHtml.ok) {
        logger.warn("detail body source asset load failed.", {
          contentId: target.value.contentId,
          error: storedHtml.error.message,
          sourceAssetSnapshotId: target.value.sourceAssetSnapshotId,
          storageKey: target.value.storageKey,
        });
        return ok(null);
      }

      const pluginLogger = logger.child({
        assetKind: target.value.assetKind,
        contentId: target.value.contentId,
        operation: "extract",
        pluginSlug: target.value.pluginSlug,
        sourceAssetSnapshotId: target.value.sourceAssetSnapshotId,
      });

      let extracted;

      try {
        extracted = await plugin.extract({
          asset: {
            body: storedHtml.value,
            kind: target.value.assetKind,
            mimeType: target.value.mimeType,
            sourceUrl: target.value.sourceUrl,
          },
          context: {
            logger: pluginLogger,
            getWebClient: (input) => getWebClient(input, pluginLogger),
          },
        });
      } catch (error) {
        logger.warn("detail body extraction failed.", {
          contentId: target.value.contentId,
          error: error instanceof Error ? error.message : String(error),
          pluginSlug: target.value.pluginSlug,
          sourceAssetSnapshotId: target.value.sourceAssetSnapshotId,
        });
        return ok(null);
      }

      if (extracted === null || extracted.body.trim() === "") {
        logger.info("detail body extract returned empty result.", {
          contentId: target.value.contentId,
          pluginSlug: target.value.pluginSlug,
          sourceAssetSnapshotId: target.value.sourceAssetSnapshotId,
        });
        return ok(null);
      }

      const createdDetailBody = await detailBodyRepository.createDetailBody({
        body: extracted.body,
        contentId: target.value.contentId,
        format: extracted.format,
        sourceAssetSnapshotId: target.value.sourceAssetSnapshotId,
      });

      if (createdDetailBody.ok) {
        logger.info("detail body created.", {
          contentId: target.value.contentId,
          detailBodyId: createdDetailBody.value.id,
          format: createdDetailBody.value.format,
          pluginSlug: target.value.pluginSlug,
          sourceAssetSnapshotId: target.value.sourceAssetSnapshotId,
        });
        return createdDetailBody;
      }

      logger.warn("detail body create failed.", {
        contentId: target.value.contentId,
        error: createdDetailBody.error.message,
        pluginSlug: target.value.pluginSlug,
        sourceAssetSnapshotId: target.value.sourceAssetSnapshotId,
      });

      const concurrentlyCreated =
        await detailBodyRepository.findDetailBodyByAssetSnapshotId(
          target.value.sourceAssetSnapshotId,
        );

      if (concurrentlyCreated.ok && concurrentlyCreated.value !== null) {
        logger.info("detail body recovered from concurrent create.", {
          contentId: target.value.contentId,
          detailBodyId: concurrentlyCreated.value.id,
          sourceAssetSnapshotId: target.value.sourceAssetSnapshotId,
        });
        return concurrentlyCreated;
      }

      if (!concurrentlyCreated.ok) {
        logger.warn("detail body concurrent lookup failed.", {
          contentId: target.value.contentId,
          error: concurrentlyCreated.error.message,
          sourceAssetSnapshotId: target.value.sourceAssetSnapshotId,
        });
      }

      return createdDetailBody;
    },
  };
}
