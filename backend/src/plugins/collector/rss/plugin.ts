import { XMLParser } from "fast-xml-parser";

import type {
  AcquiredAsset,
  ExtractedDetailBody,
  ObservedAsset,
  ObservedContent,
  SourceCollectorAcquireInput,
  SourceCollectorExtractInput,
  SourceCollectorInspectErrorCode,
  SourceCollectorInspectInput,
  SourceCollectorObserveInput,
  SourceCollectorPlugin,
  SourceCollectorPluginDefinition,
  SourceMetadata,
} from "../../types.js";
import { WebClient } from "../../types.js";
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
  enclosure?: RssEnclosure;
  guid?: string | { "#text"?: string };
  link?: string;
  pubDate?: string;
  title?: string;
};

type RssEnclosure = {
  "@_type"?: string;
  "@_url"?: string;
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

  async inspect(input: SourceCollectorInspectInput, context) {
    const webClient = WebClient.create({ kind: "fetch" });
    const userAgent = await readConfiguredUserAgent(context);
    let response: Response;

    try {
      response = await webClient.fetch(
        new Request(input.sourceUrl, {
          headers: createRequestHeaders(userAgent),
          signal: input.abortSignal,
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
    const parsedFeed = parseRssFeed(body);

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
    const parsedFeed = parseRssFeed(body);

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
      throw new Error("RSS asset sourceUrl is required.");
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
    const contentType = normalizeContentType(
      response.headers.get("content-type"),
    );

    return {
      acquiredFingerprints: createAcquiredAssetFingerprints({
        body: responseBody,
        contentType,
        kind: input.asset.kind,
        metadata: {},
        primary: input.asset.primary,
        sourceUrl: input.asset.sourceUrl,
      }),
      body: responseBody,
      contentType,
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

export const rssPlugin = plugin;
export const rssPluginDefinition = definition;

async function readConfiguredUserAgent(context: {
  getHost(): {
    pluginGlobalRuntimeState?: {
      load(): Promise<{ state: Record<string, unknown> | undefined }>;
    };
  };
}): Promise<string | null> {
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

type ParsedRssFeed = {
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
  const publishedAt = parsePublishedAt(
    normalizeString(item.pubDate) ?? undefined,
  );

  return {
    assets: toObservedAssets(item),
    contentFingerprints: createContentFingerprints({
      externalId,
      kind: "feed-entry",
      publishedAt,
      status: "discovered",
      summary,
      title,
    }),
    externalId,
    kind: "feed-entry",
    publishedAt,
    status: "discovered",
    summary,
    title,
  };
}

function toObservedAssets(item: RssItem): ObservedAsset[] {
  const assets: ObservedAsset[] = [];
  const pageUrl = normalizeString(item.link);
  const enclosureUrl = normalizeString(item.enclosure?.["@_url"]);

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

  if (enclosureUrl !== null) {
    const kind = inferEnclosureAssetKind(item.enclosure);
    const primary = pageUrl === null;

    assets.push({
      kind,
      nextAction: {
        actionKind: "acquire",
      },
      observedFingerprints: createObservedAssetFingerprints({
        kind,
        primary,
        sourceUrl: enclosureUrl,
      }),
      primary,
      sourceUrl: enclosureUrl,
    });
  }

  return assets;
}

function inferEnclosureAssetKind(enclosure: RssEnclosure | undefined): string {
  const type = normalizeString(enclosure?.["@_type"]);

  if (type?.startsWith("audio/") === true) {
    return "audio";
  }

  return "attachment";
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

function parseRssFeed(value: string): ParsedRssFeed | null {
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
