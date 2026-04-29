import type {
  ObserveSourceTarget,
  SourceListItem,
  SourceRepository,
} from "../db/source-repository.js";
import type { Result } from "../lib/result.js";
import { err } from "../lib/result.js";
import { createSourceSlug, normalizeOptionalSlug } from "../lib/source-slug.js";
import { createUrlHash } from "../lib/url-hash.js";

export type CreateSourceRequest = {
  description?: string;
  sourceSlug?: string;
  title?: string;
  url: string;
};

export type SourceUrlError = {
  code: "source_url_required" | "source_url_invalid";
  message: string;
};

export class SourceService {
  public constructor(private readonly sourceRepository: SourceRepository) {}

  public async createSource(
    request: CreateSourceRequest,
  ): Promise<Result<SourceListItem, SourceUrlError>> {
    const normalizedUrlResult = normalizeSourceUrl(request.url);

    if (!normalizedUrlResult.ok) {
      return normalizedUrlResult;
    }

    const normalizedUrl = normalizedUrlResult.value;
    const slug =
      normalizeOptionalSlug(request.sourceSlug) ??
      createSourceSlug(normalizedUrl, request.title);

    return {
      ok: true,
      value: await this.sourceRepository.createSource({
        collectorSettingId: crypto.randomUUID(),
        collectorSettingSnapshotId: crypto.randomUUID(),
        description: normalizeOptionalString(request.description),
        id: crypto.randomUUID(),
        kind: "podcast",
        pluginSlug: "podcast-rss",
        slug,
        snapshotId: crypto.randomUUID(),
        title: normalizeOptionalString(request.title),
        url: normalizedUrl,
        urlHash: createUrlHash(normalizedUrl),
      }),
    };
  }

  public async listSources(): Promise<SourceListItem[]> {
    return this.sourceRepository.listSources();
  }

  public async findObserveSourceTarget(
    sourceId: string,
  ): Promise<ObserveSourceTarget | null> {
    return this.sourceRepository.findObserveSourceTarget(sourceId);
  }
}

function normalizeOptionalString(
  value: string | undefined,
): string | undefined {
  const trimmedValue = value?.trim();

  return trimmedValue === "" ? undefined : trimmedValue;
}

export function normalizeSourceUrl(
  value: string,
): Result<string, SourceUrlError> {
  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    return err({
      code: "source_url_required",
      message: "RSS URL is required.",
    });
  }

  let url: URL;

  try {
    url = new URL(trimmedValue);
  } catch {
    return err({
      code: "source_url_invalid",
      message: "RSS URL must be an absolute http or https URL.",
    });
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return err({
      code: "source_url_invalid",
      message: "RSS URL must be an absolute http or https URL.",
    });
  }

  return {
    ok: true,
    value: url.toString(),
  };
}
