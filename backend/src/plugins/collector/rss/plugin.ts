import { XMLParser } from "fast-xml-parser";
import { parse } from "parse5";

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
  "rdf:RDF"?: {
    channel?: RssChannel;
    item?: RssItem | RssItem[];
  };
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

type Parse5Attribute = {
  name: string;
  value: string;
};

type Parse5Node = {
  attrs?: Parse5Attribute[];
  childNodes?: Parse5Node[];
  tagName?: string;
};

const parser = new XMLParser({
  attributeNamePrefix: "@_",
  ignoreAttributes: false,
  parseTagValue: false,
  trimValues: true,
});
const TEXT_DECODER_FALLBACK_ENCODING = "utf-8";
const META_CHARSET_SCAN_LENGTH = 2048;

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
      const metadata = await inspectRssSource(
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
    const metadata = await inspectRssSource(
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

    const html = decodeHtmlDocument(input.asset.body, input.asset.mimeType);

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

async function inspectRssSource(
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
  const parsedFeed = parseRssFeed(body);

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

  if (parseRssFeed(body) !== null) {
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

function decodeHtmlDocument(
  body: Uint8Array,
  contentType: string | null,
): string {
  const encoding = detectHtmlEncoding(body, contentType);

  try {
    return new TextDecoder(encoding).decode(body);
  } catch {
    return new TextDecoder(TEXT_DECODER_FALLBACK_ENCODING).decode(body);
  }
}

function detectHtmlEncoding(
  body: Uint8Array,
  contentType: string | null,
): string {
  const headerCharset = extractCharsetFromContentType(contentType);

  if (headerCharset !== null) {
    return headerCharset;
  }

  const metaCharset = extractCharsetFromHtmlMeta(body);

  if (metaCharset !== null) {
    return metaCharset;
  }

  return TEXT_DECODER_FALLBACK_ENCODING;
}

function extractCharsetFromContentType(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const match = value.match(/charset\s*=\s*["']?([^;"'\s]+)/iu);

  return normalizeEncodingLabel(match?.[1] ?? null);
}

function extractCharsetFromHtmlMeta(body: Uint8Array): string | null {
  const scanBody = new TextDecoder("latin1").decode(
    body.subarray(0, META_CHARSET_SCAN_LENGTH),
  );
  const document = parse(scanBody) as Parse5Node;
  const nodes = [document];

  while (nodes.length > 0) {
    const node = nodes.shift();

    if (node === undefined) {
      continue;
    }

    if (node.tagName === "meta") {
      const attributes = Object.fromEntries(
        (node.attrs ?? []).map((attribute) => [attribute.name, attribute.value]),
      );
      const charset = normalizeEncodingLabel(attributes.charset ?? null);

      if (charset !== null) {
        return charset;
      }

      if (attributes["http-equiv"]?.toLowerCase() === "content-type") {
        const contentCharset = extractCharsetFromContentType(
          attributes.content ?? null,
        );

        if (contentCharset !== null) {
          return contentCharset;
        }
      }
    }

    nodes.push(...(node.childNodes ?? []));
  }

  return null;
}

function normalizeEncodingLabel(value: string | null): string | null {
  const normalizedValue = value?.trim().toLowerCase();

  return normalizedValue ? normalizedValue : null;
}

function parseRssFeed(value: string): ParsedRssFeed | null {
  const parsedFeed = parser.parse(value) as RssFeed;
  const channel = parsedFeed.rss?.channel ?? parsedFeed["rdf:RDF"]?.channel;

  if (channel !== undefined) {
    return {
      items: toArray(channel.item ?? parsedFeed["rdf:RDF"]?.item),
      metadata: {
        description: normalizeString(channel.description),
        title: normalizeString(channel.title),
      },
    };
  }

  return parseAtomFeed(value);
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}
