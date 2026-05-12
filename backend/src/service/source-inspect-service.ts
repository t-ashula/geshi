import type { Result } from "../lib/result.js";
import { err, ok } from "../lib/result.js";
import { createSourceSlug } from "../lib/source-slug.js";
import type { Logger } from "../logger/index.js";
import { createLogger } from "../logger/index.js";
import type { SourceCollectorRegistry } from "../plugins/index.js";
import { defaultSourceCollectorRegistry } from "../plugins/index.js";
import type {
  SourceCollectorInspectError,
  SourceMetadata,
} from "../plugins/types.js";
import { getWebClient } from "../plugins/web-client.js";
import type { SourceUrlError } from "./source-service.js";
import { normalizeSourceUrl } from "./source-service.js";

export type InspectSourceRequest = {
  pluginSlug?: string;
  url: string;
};

export type InspectSourceUnknownError = {
  code: "source_inspect_failed";
  message: string;
};

export type InspectSourceError =
  | InspectSourceUnknownError
  | SourceCollectorInspectError
  | SourceUrlError;

export type InspectSourceResult = SourceMetadata & {
  sourceSlug: string;
};

export interface SourceInspectService {
  inspectSource(
    request: InspectSourceRequest,
  ): Promise<Result<InspectSourceResult, InspectSourceError>>;
}

export type CreateSourceInspectServiceDependencies = {
  logger?: Logger;
  sourceCollectorRegistry?: SourceCollectorRegistry;
};

export function createSourceInspectService(
  dependencies: CreateSourceInspectServiceDependencies = {},
): SourceInspectService {
  const logger =
    dependencies.logger ??
    createLogger({
      service: "source-inspect",
    });
  const sourceCollectorRegistry =
    dependencies.sourceCollectorRegistry ?? defaultSourceCollectorRegistry;

  return {
    async inspectSource(
      request: InspectSourceRequest,
    ): Promise<Result<InspectSourceResult, InspectSourceError>> {
      const inspectLogger = logger.child({
        operation: "source-inspect",
        pluginSlug: request.pluginSlug ?? "podcast-rss",
        requestUrl: request.url,
      });
      const normalizedUrlResult = normalizeSourceUrl(request.url);

      if (!normalizedUrlResult.ok) {
        inspectLogger.warn("source inspect rejected invalid URL.", {
          errorCode: normalizedUrlResult.error.code,
        });
        return normalizedUrlResult;
      }

      const normalizedUrl = normalizedUrlResult.value;
      inspectLogger.info("source inspect started.", {
        normalizedUrl,
      });
      const plugin = sourceCollectorRegistry.get(
        request.pluginSlug ?? "podcast-rss",
      );
      try {
        const pluginLogger = inspectLogger.child({
          pluginApi: "inspect",
        });
        const sourceMetadata = await plugin.inspect({
          abortSignal: new AbortController().signal,
          config: {},
          context: {
            getWebClient(input) {
              return getWebClient(input, pluginLogger);
            },
            logger: pluginLogger,
          },
          sourceUrl: normalizedUrl,
        });
        inspectLogger.info("source inspect completed.", {
          metadataUrl: sourceMetadata.url,
          title: sourceMetadata.title,
        });

        return ok({
          ...sourceMetadata,
          sourceSlug: createSourceSlug(
            sourceMetadata.url,
            sourceMetadata.title ?? undefined,
          ),
        });
      } catch (error) {
        if (isSourceCollectorInspectError(error)) {
          inspectLogger.warn("source inspect failed with known plugin error.", {
            errorCode: error.code,
            errorMessage: error.message,
          });
          return err(error);
        }

        inspectLogger.error("source inspect failed with unexpected error.", {
          error,
        });
        return err({
          code: "source_inspect_failed",
          message:
            error instanceof Error ? error.message : "Source inspect failed.",
        });
      }
    },
  };
}

function isSourceCollectorInspectError(
  error: unknown,
): error is SourceCollectorInspectError {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const candidate = error as Record<string, unknown>;

  return (
    typeof candidate.code === "string" &&
    typeof candidate.message === "string" &&
    candidate.code.startsWith("source_inspect_")
  );
}
