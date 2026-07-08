import type { PluginGlobalRuntimeStateRepository } from "../db/plugin-global-runtime-state-repository.js";
import type { Result } from "../lib/result.js";
import { err, ok } from "../lib/result.js";
import type { Logger } from "../logger/index.js";
import { createLogger } from "../logger/index.js";
import type {
  RegisteredSourceCollectorPlugin,
  SourceCollectorRegistry,
} from "../plugins/index.js";
import { defaultSourceCollectorRegistry } from "../plugins/index.js";
import { createPluginGlobalRuntimeStateHost } from "../plugins/plugin-global-runtime-state-host.js";
import type { SourceCollectorPreviewResult } from "../plugins/types.js";
import type { SourceUrlError } from "./source-service.js";
import { normalizeSourceUrl } from "./source-service.js";

export type DiscoverSourcesRequest = {
  url: string;
};

export type SourceDiscoveryCandidate = {
  description: string | null;
  pluginSlug: string;
  previewAvailable: boolean;
  sourceKind: "feed" | "podcast" | "streaming";
  sourceSlug: string;
  title: string | null;
  url: string;
};

export type DiscoverSourcesResult = {
  candidates: SourceDiscoveryCandidate[];
};

export type PreviewSourceRequest = {
  pluginSlug: string;
  url: string;
};

export type PreviewSourceResult = SourceCollectorPreviewResult;

export type PreviewSourceError =
  | SourceUrlError
  | {
      code: "source_preview_failed";
      message: string;
    }
  | {
      code: "source_preview_plugin_required";
      message: string;
    };

export interface SourceDiscoveryService {
  discoverSources(
    request: DiscoverSourcesRequest,
  ): Promise<Result<DiscoverSourcesResult, SourceUrlError>>;
  previewSource(
    request: PreviewSourceRequest,
  ): Promise<Result<PreviewSourceResult, PreviewSourceError>>;
}

export type CreateSourceDiscoveryServiceDependencies = {
  logger?: Logger;
  pluginGlobalRuntimeStateRepository?: PluginGlobalRuntimeStateRepository;
  sourceCollectorRegistry?: SourceCollectorRegistry;
};

export function createSourceDiscoveryService(
  dependencies: CreateSourceDiscoveryServiceDependencies = {},
): SourceDiscoveryService {
  const logger =
    dependencies.logger ??
    createLogger({
      service: "source-discovery",
    });
  const sourceCollectorRegistry =
    dependencies.sourceCollectorRegistry ?? defaultSourceCollectorRegistry;
  const pluginGlobalRuntimeStateRepository =
    dependencies.pluginGlobalRuntimeStateRepository;

  return {
    async discoverSources(
      request: DiscoverSourcesRequest,
    ): Promise<Result<DiscoverSourcesResult, SourceUrlError>> {
      const discoveryLogger = logger.child({
        operation: "source-discover",
        requestUrl: request.url,
      });
      const normalizedUrlResult = normalizeSourceUrl(request.url);

      if (!normalizedUrlResult.ok) {
        discoveryLogger.warn("source discovery rejected invalid URL.", {
          errorCode: normalizedUrlResult.error.code,
        });
        return normalizedUrlResult;
      }

      const normalizedUrl = normalizedUrlResult.value;
      discoveryLogger.info("source discovery started.", {
        normalizedUrl,
      });
      const candidates: SourceDiscoveryCandidate[] = [];

      for (const registeredPlugin of sourceCollectorRegistry.list()) {
        if (registeredPlugin.status !== "available") {
          continue;
        }

        const plugin = registeredPlugin.definition.plugin;
        const pluginLogger = discoveryLogger.child({
          pluginSlug: registeredPlugin.pluginSlug,
          pluginApi:
            plugin.discover !== undefined ? "discover" : "inspect-fallback",
        });

        try {
          pluginLogger.info("source discovery plugin started.");
          if (plugin.discover !== undefined) {
            const result = await plugin.discover(
              {
                abortSignal: new AbortController().signal,
                config: {},
                inputUrl: normalizedUrl,
              },
              createExecutionContext(
                registeredPlugin,
                pluginGlobalRuntimeStateRepository,
                logger,
              ),
            );

            candidates.push(
              ...result.candidates.map((candidate) => ({
                ...candidate,
                pluginSlug: registeredPlugin.pluginSlug,
                previewAvailable: plugin.preview !== undefined,
                sourceKind: registeredPlugin.sourceKind,
              })),
            );

            pluginLogger.info("source discovery plugin completed.", {
              candidateCount: result.candidates.length,
            });

            continue;
          }

          const metadata = await plugin.inspect(
            {
              abortSignal: new AbortController().signal,
              config: {},
              sourceUrl: normalizedUrl,
            },
            createExecutionContext(
              registeredPlugin,
              pluginGlobalRuntimeStateRepository,
              logger,
            ),
          );

          candidates.push({
            description: metadata.description,
            pluginSlug: registeredPlugin.pluginSlug,
            previewAvailable: plugin.preview !== undefined,
            sourceKind: registeredPlugin.sourceKind,
            sourceSlug:
              metadata.sourceSlug ??
              `${registeredPlugin.pluginSlug}-${candidates.length + 1}`,
            title: metadata.title,
            url: metadata.url,
          });
          pluginLogger.info("source discovery plugin completed.", {
            candidateCount: 1,
            metadataUrl: metadata.url,
            title: metadata.title,
          });
        } catch (error) {
          pluginLogger.info("source discovery plugin rejected candidate.", {
            error,
          });
        }
      }

      const dedupedCandidates = dedupeCandidates(candidates);
      discoveryLogger.info("source discovery completed.", {
        candidateCount: candidates.length,
        dedupedCandidateCount: dedupedCandidates.length,
      });

      return ok({
        candidates: dedupedCandidates,
      });
    },

    async previewSource(
      request: PreviewSourceRequest,
    ): Promise<Result<PreviewSourceResult, PreviewSourceError>> {
      const previewLogger = logger.child({
        operation: "source-preview",
        pluginSlug: request.pluginSlug,
        requestUrl: request.url,
      });
      const normalizedUrlResult = normalizeSourceUrl(request.url);

      if (!normalizedUrlResult.ok) {
        previewLogger.warn("source preview rejected invalid URL.", {
          errorCode: normalizedUrlResult.error.code,
        });
        return normalizedUrlResult;
      }

      if (request.pluginSlug.trim() === "") {
        previewLogger.warn("source preview rejected missing plugin slug.");
        return err({
          code: "source_preview_plugin_required",
          message: "Source collector plugin is required.",
        });
      }

      previewLogger.info("source preview started.", {
        normalizedUrl: normalizedUrlResult.value,
      });

      try {
        const plugin = sourceCollectorRegistry.get(request.pluginSlug);
        const registeredPlugin = sourceCollectorRegistry
          .list()
          .find(
            (
              entry,
            ): entry is Extract<
              RegisteredSourceCollectorPlugin,
              { status: "available" }
            > =>
              entry.pluginSlug === request.pluginSlug &&
              entry.status === "available",
          );

        if (plugin.preview === undefined || registeredPlugin === undefined) {
          previewLogger.info(
            "source preview completed without plugin preview.",
          );
          return ok({
            items: [],
          });
        }

        const result = await plugin.preview(
          {
            abortSignal: new AbortController().signal,
            config: {},
            sourceUrl: normalizedUrlResult.value,
          },
          createExecutionContext(
            registeredPlugin,
            pluginGlobalRuntimeStateRepository,
            logger,
          ),
        );
        previewLogger.info("source preview completed.", {
          itemCount: result.items.length,
        });

        return ok(result);
      } catch (error) {
        previewLogger.error("source preview failed.", {
          error,
        });
        return err({
          code: "source_preview_failed",
          message:
            error instanceof Error ? error.message : "Source preview failed.",
        });
      }
    },
  };
}

function createExecutionContext(
  plugin: Extract<RegisteredSourceCollectorPlugin, { status: "available" }>,
  pluginGlobalRuntimeStateRepository:
    PluginGlobalRuntimeStateRepository | undefined,
  logger: Logger,
) {
  return {
    getHost() {
      return {
        logger: logger.child({
          pluginApi: "source-discovery",
          pluginSlug: plugin.pluginSlug,
        }),
        pluginGlobalRuntimeState:
          pluginGlobalRuntimeStateRepository === undefined
            ? undefined
            : createPluginGlobalRuntimeStateHost(
                pluginGlobalRuntimeStateRepository,
                plugin.pluginSlug,
              ),
      };
    },
  };
}

function dedupeCandidates(
  candidates: SourceDiscoveryCandidate[],
): SourceDiscoveryCandidate[] {
  const deduped = new Map<string, SourceDiscoveryCandidate>();

  for (const candidate of candidates) {
    const key = [
      candidate.pluginSlug,
      candidate.sourceKind,
      candidate.url,
      candidate.sourceSlug,
    ].join("::");

    if (!deduped.has(key)) {
      deduped.set(key, candidate);
    }
  }

  return [...deduped.values()];
}
