import { XMLParser } from "fast-xml-parser";

import type {
  AcquiredAsset,
  ObservedAsset,
  ObservedContent,
  SourceCollectorAcquireInput,
  SourceCollectorInspectErrorCode,
  SourceCollectorInspectInput,
  SourceCollectorObserveInput,
  SourceCollectorPlugin,
  SourceMetadata,
} from "../../types.js";
import type {
  AcquiredAssetFingerprintInput,
  AcquiredAssetFingerprintSpec,
  ContentFingerprintSpec,
  ObservedAssetFingerprintInput,
  ObservedAssetFingerprintSpec,
  ObservedContentFingerprintInput,
} from "./fingerprint.js";
import {
  ACQUIRED_ASSET_FINGERPRINT_SPECS,
  CONTENT_FINGERPRINT_SPECS,
  OBSERVED_ASSET_FINGERPRINT_SPECS,
} from "./fingerprint.js";

type RssChannel = {
  description?: string;
  item?: RssItem | RssItem[];
  title?: string;
};

type RssFeed = {
  rss?: {
    channel?: RssChannel;
  };
};

type RssItem = {
  description?: string;
  enclosure?: {
    "@_url"?: string;
  };
  guid?: string | { "#text"?: string };
  link?: string;
  pubDate?: string;
  title?: string;
};

const parser = new XMLParser({
  attributeNamePrefix: "@_",
  ignoreAttributes: false,
  parseTagValue: false,
  trimValues: true,
});

class SourceCollectorInspectPluginError extends Error {
  public readonly code: SourceCollectorInspectErrorCode;

  public constructor(code: SourceCollectorInspectErrorCode, message: string) {
    super(message);
    this.name = "SourceCollectorInspectPluginError";
    this.code = code;
  }
}

export const podcastRssPlugin: SourceCollectorPlugin = {
  pluginSlug: "podcast-rss",
  sourceKind: "podcast",

  async inspect(input: SourceCollectorInspectInput) {
    const response = await fetch(input.sourceUrl, {
      signal: input.abortSignal,
    }).catch(() => null);

    if (response === null || !response.ok) {
      throw new SourceCollectorInspectPluginError(
        "source_inspect_fetch_failed",
        "Failed to fetch source metadata.",
      );
    }

    const body = await response.text();
    const parsedFeed = parsePodcastRssFeed(body);

    if (parsedFeed === null) {
      throw new SourceCollectorInspectPluginError(
        "source_inspect_unrecognized",
        "The given URL is not a supported RSS feed.",
      );
    }

    return {
      description: parsedFeed.metadata.description,
      title: parsedFeed.metadata.title,
      url: input.sourceUrl,
    };
  },

  async observe(
    input: SourceCollectorObserveInput,
  ): Promise<ObservedContent[]> {
    const response = await fetch(input.sourceUrl, {
      signal: input.abortSignal,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch RSS feed: ${response.status}`);
    }

    const body = await response.text();
    const parsedFeed = parsePodcastRssFeed(body);

    if (parsedFeed === null) {
      throw new Error("Invalid RSS feed.");
    }

    return parsedFeed.items
      .map(toObservedContent)
      .filter((item): item is ObservedContent => item !== null);
  },

  async acquire(input: SourceCollectorAcquireInput): Promise<AcquiredAsset> {
    if (input.asset.sourceUrl === null) {
      throw new Error("Podcast RSS asset sourceUrl is required.");
    }

    const response = await fetch(input.asset.sourceUrl, {
      signal: input.abortSignal,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch asset: ${response.status}`);
    }

    const responseBody = new Uint8Array(await response.arrayBuffer());

    return {
      acquiredFingerprints: createAcquiredAssetFingerprints({
        body: responseBody,
        contentType: normalizeContentType(response.headers.get("content-type")),
        kind: input.asset.kind,
        metadata: {},
        primary: input.asset.primary,
        sourceUrl: input.asset.sourceUrl,
      }),
      body: responseBody,
      contentType: normalizeContentType(response.headers.get("content-type")),
      kind: input.asset.kind,
      metadata: {},
      primary: input.asset.primary,
      sourceUrl: input.asset.sourceUrl,
    };
  },
};

type ParsedPodcastRssFeed = {
  items: RssItem[];
  metadata: Pick<SourceMetadata, "description" | "title">;
};

function toObservedContent(item: RssItem): ObservedContent | null {
  const externalId =
    normalizeString(readGuid(item.guid)) ??
    normalizeString(item.link) ??
    normalizeString(item.enclosure?.["@_url"]);

  if (externalId === null) {
    return null;
  }

  const summary = normalizeString(item.description);
  const title = normalizeString(item.title);
  const publishedAt = normalizeString(item.pubDate);

  return {
    assets: toObservedAssets(item),
    contentFingerprints: createContentFingerprints({
      externalId,
      kind: "podcast-episode",
      publishedAt: parsePublishedAt(publishedAt ?? undefined),
      status: "discovered",
      summary: normalizeString(item.description),
      title: normalizeString(item.title),
    }),
    externalId,
    kind: "podcast-episode",
    publishedAt: parsePublishedAt(publishedAt ?? undefined),
    status: "discovered",
    summary,
    title,
  };
}

function toObservedAssets(item: RssItem): ObservedAsset[] {
  const assets: ObservedAsset[] = [];
  const pageUrl = normalizeString(item.link);
  const audioUrl = normalizeString(item.enclosure?.["@_url"]);

  if (pageUrl !== null) {
    assets.push({
      kind: "html",
      observedFingerprints: createObservedAssetFingerprints({
        kind: "html",
        primary: true,
        sourceUrl: pageUrl,
      }),
      primary: true,
      sourceUrl: pageUrl,
    });
  }

  if (audioUrl !== null) {
    assets.push({
      kind: "audio",
      observedFingerprints: createObservedAssetFingerprints({
        kind: "audio",
        primary: false,
        sourceUrl: audioUrl,
      }),
      primary: false,
      sourceUrl: audioUrl,
    });
  }

  return assets;
}

function createContentFingerprints(
  input: ObservedContentFingerprintInput,
): string[] {
  return CONTENT_FINGERPRINT_SPECS.map((spec) =>
    createContentFingerprint(spec, input),
  );
}

function createObservedAssetFingerprints(
  asset: ObservedAssetFingerprintInput,
): string[] {
  return OBSERVED_ASSET_FINGERPRINT_SPECS.map((spec) =>
    createObservedAssetFingerprint(spec, asset),
  );
}

function createAcquiredAssetFingerprints(
  asset: AcquiredAssetFingerprintInput,
): string[] {
  return ACQUIRED_ASSET_FINGERPRINT_SPECS.map((spec) =>
    createAcquiredAssetFingerprint(spec, asset),
  );
}

function createContentFingerprint(
  spec: ContentFingerprintSpec<ObservedContentFingerprintInput>,
  input: ObservedContentFingerprintInput,
): string {
  return `${spec.version}:${spec.create(input)}`;
}

function createObservedAssetFingerprint(
  spec: ObservedAssetFingerprintSpec<ObservedAssetFingerprintInput>,
  asset: ObservedAssetFingerprintInput,
): string {
  return `${spec.version}:${spec.create(asset)}`;
}

function createAcquiredAssetFingerprint(
  spec: AcquiredAssetFingerprintSpec<AcquiredAssetFingerprintInput>,
  asset: AcquiredAssetFingerprintInput,
): string {
  return `${spec.version}:${spec.create(asset)}`;
}

function readGuid(guid: RssItem["guid"]): string | undefined {
  if (typeof guid === "string") {
    return guid;
  }

  return guid?.["#text"];
}

function parsePublishedAt(value: string | undefined): Date | null {
  if (value === undefined) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeString(value: string | undefined): string | null {
  const normalizedValue = value?.trim();

  return normalizedValue ? normalizedValue : null;
}

function normalizeContentType(value: string | null): string | null {
  const normalizedValue = value?.split(";")[0]?.trim();

  return normalizedValue ? normalizedValue : null;
}

function parsePodcastRssFeed(value: string): ParsedPodcastRssFeed | null {
  const parsedFeed = parser.parse(value) as RssFeed;
  const channel = parsedFeed.rss?.channel;

  if (channel === undefined) {
    return null;
  }

  return {
    items: toArray(channel.item),
    metadata: {
      description: normalizeString(channel.description),
      title: normalizeString(channel.title),
    },
  };
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}
