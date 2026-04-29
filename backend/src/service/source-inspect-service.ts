import type { Result } from "../lib/result.js";
import { err, ok } from "../lib/result.js";
import { createSourceSlug } from "../lib/source-slug.js";
import { createNoopLogger } from "../logger/index.js";
import { getSourceCollectorPlugin } from "../plugins/index.js";
import type {
  SourceCollectorInspectError,
  SourceMetadata,
} from "../plugins/types.js";
import type { SourceUrlError } from "./source-service.js";
import { normalizeSourceUrl } from "./source-service.js";

export type InspectSourceRequest = {
  url: string;
};

export type InspectSourceError = SourceCollectorInspectError | SourceUrlError;

export type InspectSourceResult = SourceMetadata & {
  sourceSlug: string;
};

export class SourceInspectService {
  public async inspectSource(
    request: InspectSourceRequest,
  ): Promise<Result<InspectSourceResult, InspectSourceError>> {
    const normalizedUrlResult = normalizeSourceUrl(request.url);

    if (!normalizedUrlResult.ok) {
      return normalizedUrlResult;
    }

    const normalizedUrl = normalizedUrlResult.value;
    try {
      const sourceMetadata = await getSourceCollectorPlugin(
        "podcast-rss",
      ).inspect({
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

      throw error;
    }
  }
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
