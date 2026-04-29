import type { Result } from "../lib/result.js";
import { ok } from "../lib/result.js";
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

    const result = await getSourceCollectorPlugin("podcast-rss").inspect({
      abortSignal: new AbortController().signal,
      config: {},
      logger: createNoopLogger(),
      sourceUrl: normalizedUrl,
    });

    if (!result.ok) {
      return result;
    }

    return ok({
      ...result.value,
      sourceSlug: createSourceSlug(
        result.value.url,
        result.value.title ?? undefined,
      ),
    });
  }
}
