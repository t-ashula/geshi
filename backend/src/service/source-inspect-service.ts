import type { Result } from "../lib/result.js";
import { err, ok } from "../lib/result.js";
import { createSourceSlug } from "../lib/source-slug.js";
import { createNoopLogger } from "../logger/index.js";
import type { SourceCollectorRegistry } from "../plugins/index.js";
import { defaultSourceCollectorRegistry } from "../plugins/index.js";
import type {
  SourceCollectorInspectError,
  SourceMetadata,
} from "../plugins/types.js";
import type { SourceUrlError } from "./source-service.js";
import { normalizeSourceUrl } from "./source-service.js";

export type InspectSourceRequest = {
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
  sourceCollectorRegistry?: SourceCollectorRegistry;
};

export function createSourceInspectService(
  dependencies: CreateSourceInspectServiceDependencies = {},
): SourceInspectService {
  const sourceCollectorRegistry =
    dependencies.sourceCollectorRegistry ?? defaultSourceCollectorRegistry;

  return {
    async inspectSource(
      request: InspectSourceRequest,
    ): Promise<Result<InspectSourceResult, InspectSourceError>> {
      const normalizedUrlResult = normalizeSourceUrl(request.url);

      if (!normalizedUrlResult.ok) {
        return normalizedUrlResult;
      }

      const normalizedUrl = normalizedUrlResult.value;
      const plugin = sourceCollectorRegistry.get("podcast-rss");
      try {
        const sourceMetadata = await plugin.inspect({
          abortSignal: new AbortController().signal,
          config: {},
          logger: createNoopLogger(),
          sourceUrl: normalizedUrl,
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
          return err(error);
        }

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
