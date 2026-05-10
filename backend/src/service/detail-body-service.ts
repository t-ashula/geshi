import type {
  DetailBodyRecord,
  DetailBodyRepository,
} from "../db/detail-body-repository.js";
import type { Result } from "../lib/result.js";
import { err, ok } from "../lib/result.js";
import type { SourceCollectorRegistry } from "../plugins/index.js";
import { defaultSourceCollectorRegistry } from "../plugins/index.js";
import type { PluginLogger } from "../plugins/types.js";
import type { Storage } from "../storage/types.js";

export interface DetailBodyService {
  findOrCreateDetailBodyByContentId(
    contentId: string,
  ): Promise<Result<DetailBodyRecord | null, Error>>;
}

export type CreateDetailBodyServiceDependencies = {
  sourceCollectorRegistry?: SourceCollectorRegistry;
};

export function createDetailBodyService(
  detailBodyRepository: DetailBodyRepository,
  storage: Storage,
  dependencies: CreateDetailBodyServiceDependencies = {},
): DetailBodyService {
  const sourceCollectorRegistry =
    dependencies.sourceCollectorRegistry ?? defaultSourceCollectorRegistry;

  return {
    async findOrCreateDetailBodyByContentId(
      contentId: string,
    ): Promise<Result<DetailBodyRecord | null, Error>> {
      const existingDetailBody =
        await detailBodyRepository.findDetailBodyByContentId(contentId);

      if (!existingDetailBody.ok) {
        return existingDetailBody;
      }

      if (existingDetailBody.value !== null) {
        return existingDetailBody;
      }

      const target =
        await detailBodyRepository.findHtmlDetailBodyTargetByContentId(
          contentId,
        );

      if (!target.ok) {
        return target;
      }

      if (target.value === null) {
        return ok(null);
      }

      const alreadyGenerated =
        await detailBodyRepository.findDetailBodyByAssetSnapshotId(
          target.value.sourceAssetSnapshotId,
        );

      if (!alreadyGenerated.ok) {
        return alreadyGenerated;
      }

      if (alreadyGenerated.value !== null) {
        return alreadyGenerated;
      }

      let plugin;

      try {
        plugin = sourceCollectorRegistry.get(target.value.pluginSlug);
      } catch (error) {
        return err(
          error instanceof Error
            ? error
            : new Error("Failed to load source collector plugin."),
        );
      }

      const storedHtml = await storage.get(target.value.storageKey);

      if (!storedHtml.ok) {
        return ok(null);
      }

      const extracted = await plugin.extract({
        asset: {
          body: storedHtml.value,
          kind: target.value.assetKind,
          mimeType: target.value.mimeType,
          sourceUrl: target.value.sourceUrl,
        },
        context: createNoopPluginContext(),
      });

      if (extracted === null || extracted.body.trim() === "") {
        return ok(null);
      }

      const createdDetailBody = await detailBodyRepository.createDetailBody({
        body: extracted.body,
        contentId: target.value.contentId,
        format: extracted.format,
        sourceAssetSnapshotId: target.value.sourceAssetSnapshotId,
      });

      if (createdDetailBody.ok) {
        return createdDetailBody;
      }

      const concurrentlyCreated =
        await detailBodyRepository.findDetailBodyByAssetSnapshotId(
          target.value.sourceAssetSnapshotId,
        );

      if (concurrentlyCreated.ok && concurrentlyCreated.value !== null) {
        return concurrentlyCreated;
      }

      return createdDetailBody;
    },
  };
}

function createNoopPluginContext() {
  const logger: PluginLogger = {
    debug(_message, _metadata) {},
    error(_message, _metadata) {},
    info(_message, _metadata) {},
    warn(_message, _metadata) {},
  };

  return {
    getWebClient: (_input: { kind: "browser" | "fetch" }) =>
      Promise.resolve({
        fetch: async (request: Request) => fetch(request),
      }),
    logger,
  };
}
