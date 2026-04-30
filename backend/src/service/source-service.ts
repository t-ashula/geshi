import type {
  CollectorSettingsVersionConflictError,
  DuplicateSourceUrlHashError,
  ObserveSourceTarget,
  PeriodicCrawlSourceTarget,
  SourceListItem,
  SourceRepository,
  SourceRepositoryError,
} from "../db/source-repository.js";
import type { Result } from "../lib/result.js";
import { err, ok } from "../lib/result.js";
import { createSourceSlug, normalizeOptionalSlug } from "../lib/source-slug.js";
import { createUrlHash } from "../lib/url-hash.js";
import type { SourcePeriodicCrawlSettings } from "./periodic-crawl-settings.js";

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
export type CreateSourceError =
  | SourceUrlError
  | DuplicateSourceUrlHashError
  | SourceRepositoryError;

export type UpdateSourceCollectorSettingsError = {
  code: "source_not_found";
  message: string;
};

export type FindObserveSourceTargetError = {
  code: "source_not_found";
  message: string;
};

export class SourceService {
  public constructor(private readonly sourceRepository: SourceRepository) {}

  public async createSource(
    request: CreateSourceRequest,
  ): Promise<Result<SourceListItem, CreateSourceError>> {
    const normalizedUrlResult = normalizeSourceUrl(request.url);

    if (!normalizedUrlResult.ok) {
      return normalizedUrlResult;
    }

    const normalizedUrl = normalizedUrlResult.value;
    const slug =
      normalizeOptionalSlug(request.sourceSlug) ??
      createSourceSlug(normalizedUrl, request.title);

    return this.sourceRepository.createSource({
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
    });
  }

  public async listSources(): Promise<
    Result<SourceListItem[], SourceRepositoryError>
  > {
    return this.sourceRepository.listSources();
  }

  public async findObserveSourceTarget(
    sourceId: string,
  ): Promise<
    Result<
      ObserveSourceTarget,
      FindObserveSourceTargetError | SourceRepositoryError
    >
  > {
    const source =
      await this.sourceRepository.findObserveSourceTarget(sourceId);

    if (!source.ok) {
      return source;
    }

    if (source.value === null) {
      return err({
        code: "source_not_found",
        message: "Source not found.",
      });
    }

    return ok(source.value);
  }

  public async updateSourceCollectorSettings(
    sourceId: string,
    settings: SourcePeriodicCrawlSettings,
    baseVersion: number,
  ): Promise<
    Result<
      SourceListItem,
      | UpdateSourceCollectorSettingsError
      | CollectorSettingsVersionConflictError
      | SourceRepositoryError
    >
  > {
    const source = await this.sourceRepository.updateSourceCollectorSettings(
      sourceId,
      settings,
      baseVersion,
    );

    if (!source.ok) {
      return source;
    }

    if (source.value === null) {
      return err({
        code: "source_not_found",
        message: "Source not found.",
      });
    }

    return ok(source.value);
  }

  public async listPeriodicCrawlTargets(): Promise<
    Result<PeriodicCrawlSourceTarget[], SourceRepositoryError>
  > {
    return this.sourceRepository.listPeriodicCrawlTargets();
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

  return ok(url.toString());
}
