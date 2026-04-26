import { v7 as uuidv7 } from "uuid";

import type { SourceListItem } from "../db/source-repository.js";
import type { SourceRepository } from "../db/source-repository.js";
import { createUrlHash } from "../lib/url-hash.js";

export type CreateSourceRequest = {
  description?: string;
  title?: string;
  url: string;
};

export class InvalidSourceUrlError extends Error {
  public constructor(
    public readonly code: "source_url_required" | "source_url_invalid",
    message: string,
  ) {
    super(message);
    this.name = "InvalidSourceUrlError";
  }
}

export class SourceService {
  public constructor(private readonly sourceRepository: SourceRepository) {}

  public async createSource(
    request: CreateSourceRequest,
  ): Promise<SourceListItem> {
    const normalizedUrl = normalizeSourceUrl(request.url);
    const slug = createSlug(normalizedUrl, request.title);

    return this.sourceRepository.createSource({
      description: normalizeOptionalString(request.description),
      id: uuidv7(),
      kind: "podcast",
      slug,
      snapshotId: uuidv7(),
      title: normalizeOptionalString(request.title),
      url: normalizedUrl,
      urlHash: createUrlHash(normalizedUrl),
    });
  }

  public async listSources(): Promise<SourceListItem[]> {
    return this.sourceRepository.listSources();
  }
}

function createSlug(url: string, title?: string): string {
  const preferredBase = normalizeOptionalString(title) ?? new URL(url).hostname;
  const normalizedBase = preferredBase
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "")
    .slice(0, 96);
  const suffix = uuidv7().slice(-12);

  return `${normalizedBase || "source"}-${suffix}`;
}

function normalizeOptionalString(
  value: string | undefined,
): string | undefined {
  const trimmedValue = value?.trim();

  return trimmedValue === "" ? undefined : trimmedValue;
}

function normalizeSourceUrl(value: string): string {
  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    throw new InvalidSourceUrlError(
      "source_url_required",
      "RSS URL is required.",
    );
  }

  let url: URL;

  try {
    url = new URL(trimmedValue);
  } catch {
    throw new InvalidSourceUrlError(
      "source_url_invalid",
      "RSS URL must be an absolute http or https URL.",
    );
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new InvalidSourceUrlError(
      "source_url_invalid",
      "RSS URL must be an absolute http or https URL.",
    );
  }

  return url.toString();
}
