import { XMLParser } from "fast-xml-parser";

import { createSourceSlug } from "../../../lib/source-slug.js";
import type {
  AcquiredAsset,
  ExtractedDetailBody,
  ObservedAsset,
  ObservedContent,
  SourceCollectorAcquireInput,
  SourceCollectorDiscoverInput,
  SourceCollectorDiscoverResult,
  SourceCollectorExecutionContext,
  SourceCollectorExtractInput,
  SourceCollectorInspectErrorCode,
  SourceCollectorInspectInput,
  SourceCollectorObserveInput,
  SourceCollectorPlugin,
  SourceCollectorPluginDefinition,
  SourceCollectorPreviewInput,
  SourceCollectorPreviewResult,
  SourceDiscoveryCandidate,
  SourceMetadata,
} from "../../types.js";
import { WebClient } from "../../types.js";
import { parseAtomFeed } from "../atom-feed.js";
import { extractDiscoveredFeedUrls } from "../feed-discovery-html.js";
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
import { extractHtmlDetailBody } from "./html-detail-body.js";
import { manifest } from "./manifest.js";

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

export const plugin: SourceCollectorPlugin = {
  supports() {
    return Promise.resolve({
      supported: true,
    });
  },

  globalSettingSchema() {
    return [
      {
        key: "userAgent",
        type: { type: "text" as const },
      },
    ];
  },

  settingSchema() {
    return [];
  },

  async discover(
    input: SourceCollectorDiscoverInput,
    context,
  ): Promise<SourceCollectorDiscoverResult> {
    const discoveredUrls = await discoverCandidateUrls(
      input.inputUrl,
      input.abortSignal,
      context,
    );
    const candidates: SourceDiscoveryCandidate[] = [];

    for (const sourceUrl of discoveredUrls) {
      const metadata = await inspectPodcastSource(
        sourceUrl,
        input.abortSignal,
        context,
      );

      if (metadata === null) {
        continue;
      }

      candidates.push({
        ...metadata,
        sourceSlug: createSourceSlug(metadata.url, metadata.title ?? undefined),
      });
    }

    return {
      candidates,
    };
  },

  async inspect(input: SourceCollectorInspectInput, context) {
    const metadata = await inspectPodcastSource(
      input.sourceUrl,
      input.abortSignal,
      context,
    );

    if (metadata === null) {
      throw new SourceCollectorInspectPluginError(
        "source_inspect_unrecognized",
        "The given URL is not a supported RSS or Atom feed.",
      );
    }

    return {
      description: metadata.description,
      title: metadata.title,
      url: metadata.url,
    };
  },

  async preview(
    input: SourceCollectorPreviewInput,
    context,
  ): Promise<SourceCollectorPreviewResult> {
    const observed = await this.observe(
      {
        abortSignal: input.abortSignal,
        config: input.config,
        sourceUrl: input.sourceUrl,
      },
      context,
    );

    return {
      items: observed.contents.slice(0, 3).map((content) => ({
        kind: content.kind,
        publishedAt: content.publishedAt,
        summary: content.summary,
        title: content.title,
      })),
    };
  },

  async observe(
    input: SourceCollectorObserveInput,
    context,
  ): Promise<{ contents: ObservedContent[] }> {
    const webClient = WebClient.create({ kind: "fetch" });
    const userAgent = await readConfiguredUserAgent(context);
    const response = await webClient.fetch(
      new Request(input.sourceUrl, {
        headers: createRequestHeaders(userAgent),
        signal: input.abortSignal,
      }),
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch RSS feed: ${response.status}`);
    }

    const body = await response.text();
    const parsedFeed = parsePodcastRssFeed(body);

    if (parsedFeed === null) {
      throw new Error("Invalid RSS feed.");
    }

    return {
      contents: parsedFeed.items
        .map(toObservedContent)
        .filter((item): item is ObservedContent => item !== null),
    };
  },

  extract(
    input: SourceCollectorExtractInput,
    _context,
  ): Promise<ExtractedDetailBody | null> {
    if (input.asset.kind !== "html") {
      return Promise.resolve(null);
    }

    const html = new TextDecoder().decode(input.asset.body);

    return Promise.resolve(extractHtmlDetailBody(html, input.asset.sourceUrl));
  },

  async acquire(
    input: SourceCollectorAcquireInput,
    context,
  ): Promise<AcquiredAsset> {
    if (input.asset.sourceUrl === null) {
      throw new Error("Podcast RSS asset sourceUrl is required.");
    }

    const webClient = WebClient.create({ kind: "fetch" });
    const userAgent = await readConfiguredUserAgent(context);
    const response = await webClient.fetch(
      new Request(input.asset.sourceUrl, {
        headers: createRequestHeaders(userAgent),
        signal: input.abortSignal,
      }),
    );

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

export const definition: SourceCollectorPluginDefinition = {
  manifest,
  plugin,
};

export const podcastRssPlugin = plugin;
export const podcastRssPluginDefinition = definition;

async function inspectPodcastSource(
  sourceUrl: string,
  abortSignal: AbortSignal,
  context: SourceCollectorExecutionContext,
): Promise<SourceMetadata | null> {
  const webClient = WebClient.create({ kind: "fetch" });
  const userAgent = await readConfiguredUserAgent(context);
  let response: Response;

  try {
    response = await webClient.fetch(
      new Request(sourceUrl, {
        headers: createRequestHeaders(userAgent),
        signal: abortSignal,
      }),
    );
  } catch {
    throw new SourceCollectorInspectPluginError(
      "source_inspect_fetch_failed",
      "Failed to fetch source metadata.",
    );
  }

  if (!response.ok) {
    throw new SourceCollectorInspectPluginError(
      "source_inspect_fetch_failed",
      "Failed to fetch source metadata.",
    );
  }

  const body = await response.text();
  const parsedFeed = parsePodcastRssFeed(body);

  if (parsedFeed === null) {
    return null;
  }

  return {
    description: parsedFeed.metadata.description,
    title: parsedFeed.metadata.title,
    url: sourceUrl,
  };
}

async function discoverCandidateUrls(
  inputUrl: string,
  abortSignal: AbortSignal,
  context: SourceCollectorExecutionContext,
): Promise<string[]> {
  const webClient = WebClient.create({ kind: "fetch" });
  const userAgent = await readConfiguredUserAgent(context);
  let response: Response;

  try {
    response = await webClient.fetch(
      new Request(inputUrl, {
        headers: createRequestHeaders(userAgent),
        signal: abortSignal,
      }),
    );
  } catch {
    throw new SourceCollectorInspectPluginError(
      "source_inspect_fetch_failed",
      "Failed to fetch source metadata.",
    );
  }

  if (!response.ok) {
    throw new SourceCollectorInspectPluginError(
      "source_inspect_fetch_failed",
      "Failed to fetch source metadata.",
    );
  }

  const body = await response.text();

  if (parsePodcastRssFeed(body) !== null) {
    return [inputUrl];
  }

  return extractDiscoveredFeedUrls(body, inputUrl);
}

async function readConfiguredUserAgent(
  context: SourceCollectorExecutionContext,
): Promise<string | null> {
  const snapshot = await context.getHost().pluginGlobalRuntimeState?.load();
  const candidate = snapshot?.state?.userAgent;
  return typeof candidate === "string" && candidate.trim() !== ""
    ? candidate
    : null;
}

function createRequestHeaders(
  userAgent: string | null,
): HeadersInit | undefined {
  if (userAgent === null) {
    return undefined;
  }

  return {
    "user-agent": userAgent,
  };
}

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
      nextAction: {
        actionKind: "acquire",
      },
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
      nextAction: {
        actionKind: "acquire",
      },
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

  if (channel !== undefined) {
    return {
      items: toArray(channel.item),
      metadata: {
        description: normalizeString(channel.description),
        title: normalizeString(channel.title),
      },
    };
  }

  return parseAtomFeed(value, {
    requireAudioEnclosure: true,
  });
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}
