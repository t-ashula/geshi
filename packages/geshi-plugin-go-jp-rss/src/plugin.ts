import type {
  AcquiredAsset,
  JsonObject,
  ObservedContent,
  SourceCollectorAcquireInput,
  SourceCollectorInspectErrorCode,
  SourceCollectorInspectInput,
  SourceCollectorObserveInput,
  SourceCollectorObserveResult,
  SourceCollectorPlugin,
  SourceCollectorPluginDefinition,
  SourceCollectorSupportsInput,
  SourceMetadata,
} from "@geshi/plugin-api";

import { manifest } from "./manifest.js";

const DEFAULT_CONTENT_TYPE = "text/html";
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.000.0 Safari/537.36";
const GOV_ONLINE_HOST = "www.gov-online.go.jp";
const GOV_ONLINE_INFO_PATHS = new Set(["/info/", "/info/index.html"]);
const MAX_ITEMS = 40;
const ONE_WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000;

class SourceCollectorInspectPluginError extends Error {
  public readonly code: SourceCollectorInspectErrorCode;

  public constructor(code: SourceCollectorInspectErrorCode, message: string) {
    super(message);
    this.name = "SourceCollectorInspectPluginError";
    this.code = code;
  }
}

type GovOnlineEntry = {
  category: string | null;
  publishedAt: Date | null;
  publishedAtText: string | null;
  title: string | null;
  url: string;
};

type GovOnlinePage = {
  entries: GovOnlineEntry[];
  metadata: Pick<SourceMetadata, "description" | "title">;
  nextPageUrl: string | null;
};

export const plugin: SourceCollectorPlugin = {
  supports(
    input: SourceCollectorSupportsInput,
  ): Promise<{ supported: boolean }> {
    return Promise.resolve({
      supported: isSupportedSourceUrl(input.sourceUrl),
    });
  },

  async inspect(input: SourceCollectorInspectInput) {
    assertSupportedSourceUrl(input.sourceUrl);

    const page = await fetchGovOnlinePage(input.sourceUrl, input.abortSignal);

    if (page.metadata.title === null && page.metadata.description === null) {
      throw new SourceCollectorInspectPluginError(
        "source_inspect_unrecognized",
        "Failed to recognize the gov-online source metadata.",
      );
    }

    return {
      description: page.metadata.description,
      title: page.metadata.title,
      url: input.sourceUrl,
    };
  },

  async observe(
    input: SourceCollectorObserveInput,
  ): Promise<SourceCollectorObserveResult> {
    assertSupportedSourceUrl(input.sourceUrl);

    const now = Date.now();
    const oneWeekAgo = now - ONE_WEEK_IN_MS;
    const lastProcessedUrl = readLastProcessedUrl(input.collectorPluginState);
    const observedContents: ObservedContent[] = [];
    const seenUrls = new Set<string>();
    let currentUrl = input.sourceUrl;

    while (observedContents.length < MAX_ITEMS) {
      const page = await fetchGovOnlinePage(currentUrl, input.abortSignal);

      if (page.entries.length === 0) {
        break;
      }

      let reachedLastProcessedUrl = false;
      let reachedOldEntry = false;

      for (const entry of page.entries) {
        if (entry.url === lastProcessedUrl) {
          reachedLastProcessedUrl = true;
          break;
        }

        if (seenUrls.has(entry.url)) {
          continue;
        }

        if (
          entry.publishedAt !== null &&
          entry.publishedAt.getTime() < oneWeekAgo
        ) {
          reachedOldEntry = true;
          break;
        }

        seenUrls.add(entry.url);
        observedContents.push(toObservedContent(entry));

        if (observedContents.length >= MAX_ITEMS) {
          break;
        }
      }

      if (
        reachedLastProcessedUrl ||
        reachedOldEntry ||
        observedContents.length >= MAX_ITEMS ||
        page.nextPageUrl === null
      ) {
        break;
      }

      currentUrl = page.nextPageUrl;
    }

    return {
      collectorPluginState:
        observedContents[0] === undefined
          ? undefined
          : {
              lastProcessedUrl: observedContents[0].externalId,
            },
      contents: observedContents,
    };
  },

  async acquire(input: SourceCollectorAcquireInput): Promise<AcquiredAsset> {
    if (input.asset.sourceUrl === null) {
      throw new Error("go-jp-rss asset sourceUrl is required.");
    }

    const response = await fetch(input.asset.sourceUrl, {
      headers: {
        "User-Agent": DEFAULT_USER_AGENT,
      },
      signal: input.abortSignal,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch asset: ${response.status}`);
    }

    const body = new Uint8Array(await response.arrayBuffer());
    const contentType = normalizeContentType(
      response.headers.get("content-type"),
      DEFAULT_CONTENT_TYPE,
    );

    return {
      acquiredFingerprints: [
        createFingerprint(
          "acquired-html",
          `${input.asset.sourceUrl}:${body.byteLength}`,
        ),
      ],
      body,
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

export const goJpRssPlugin = plugin;
export const goJpRssPluginDefinition = definition;

function assertSupportedSourceUrl(sourceUrl: string): void {
  if (!isSupportedSourceUrl(sourceUrl)) {
    throw new SourceCollectorInspectPluginError(
      "source_inspect_unsupported",
      "The go-jp-rss plugin only supports gov-online ministry news pages.",
    );
  }
}

function isSupportedSourceUrl(sourceUrl: string): boolean {
  const url = new URL(sourceUrl);

  return (
    url.hostname === GOV_ONLINE_HOST &&
    GOV_ONLINE_INFO_PATHS.has(normalizeInfoPath(url.pathname))
  );
}

async function fetchGovOnlinePage(
  sourceUrl: string,
  abortSignal: AbortSignal,
): Promise<GovOnlinePage> {
  const response = await fetch(sourceUrl, {
    headers: {
      "User-Agent": DEFAULT_USER_AGENT,
    },
    signal: abortSignal,
  }).catch(() => null);

  if (response === null || !response.ok) {
    throw new SourceCollectorInspectPluginError(
      "source_inspect_fetch_failed",
      "Failed to fetch gov-online source.",
    );
  }

  const body = await response.text();

  return parseGovOnlinePage(body, sourceUrl);
}

function parseGovOnlinePage(body: string, sourceUrl: string): GovOnlinePage {
  return {
    entries: parseGovOnlineEntries(body, sourceUrl),
    metadata: parseGovOnlineMetadata(body),
    nextPageUrl: parseNextPageUrl(body, sourceUrl),
  };
}

function parseGovOnlineMetadata(
  body: string,
): Pick<SourceMetadata, "description" | "title"> {
  const pageTitle = normalizeWhitespace(
    decodeHtmlEntities(firstMatch(body, /<title[^>]*>(.*?)<\/title>/isu)),
  );
  const description = normalizeWhitespace(
    decodeHtmlEntities(
      firstMatch(
        body,
        /<meta[^>]+name=["']description["'][^>]+content=["'](.*?)["'][^>]*>/isu,
      ) ??
        firstMatch(
          body,
          /<meta[^>]+content=["'](.*?)["'][^>]+name=["']description["'][^>]*>/isu,
        ),
    ),
  );

  return {
    description,
    title: stripGovOnlineTitleSuffix(pageTitle),
  };
}

function parseGovOnlineEntries(
  body: string,
  sourceUrl: string,
): GovOnlineEntry[] {
  const itemPattern = /<li class=["']p-newsList__item["'][^>]*>(.*?)<\/li>/gis;
  const entries: GovOnlineEntry[] = [];

  for (const match of body.matchAll(itemPattern)) {
    const itemHtml = match[1] ?? "";
    const href = normalizeWhitespace(
      decodeHtmlEntities(
        firstMatch(
          itemHtml,
          /<a class=["']p-newsList__link["'][^>]+href=["'](.*?)["']/isu,
        ),
      ),
    );

    if (href === null) {
      continue;
    }

    const resolvedUrl = safeResolveUrl(href, sourceUrl);

    if (resolvedUrl === null) {
      continue;
    }

    const title = normalizeWhitespace(
      decodeHtmlEntities(
        stripTags(
          firstMatch(
            itemHtml,
            /<span class=["']p-newsList__title["'][^>]*>(.*?)<\/span>/isu,
          ) ?? "",
        ),
      ),
    );
    const category = normalizeWhitespace(
      decodeHtmlEntities(
        stripTags(
          firstMatch(
            itemHtml,
            /<span class=["']p-newsList__categoryLabel["'][^>]*>(.*?)<\/span>/isu,
          ) ?? "",
        ),
      ),
    );
    const publishedAtValue = normalizeWhitespace(
      firstMatch(
        itemHtml,
        /<time class=["']p-newsList__date["'][^>]+datetime=["'](.*?)["']/isu,
      ),
    );
    const publishedAtText = normalizeWhitespace(
      decodeHtmlEntities(
        stripTags(
          firstMatch(
            itemHtml,
            /<time class=["']p-newsList__date["'][^>]*>(.*?)<\/time>/isu,
          ) ?? "",
        ),
      ),
    );

    entries.push({
      category,
      publishedAt: parsePublishedAt(publishedAtValue),
      publishedAtText,
      title,
      url: resolvedUrl,
    });
  }

  return entries;
}

function parseNextPageUrl(body: string, sourceUrl: string): string | null {
  const nextPageHref = normalizeWhitespace(
    decodeHtmlEntities(
      firstMatch(
        body,
        /<div class=["']p-pagination__next["'][^>]*>\s*<a href=["'](.*?)["']/isu,
      ),
    ),
  );

  if (nextPageHref === null) {
    return null;
  }

  return safeResolveUrl(nextPageHref, sourceUrl);
}

function toObservedContent(entry: GovOnlineEntry): ObservedContent {
  return {
    assets: [
      {
        kind: "html",
        observedFingerprints: [
          createFingerprint("observed-html-url", entry.url),
        ],
        primary: true,
        sourceUrl: entry.url,
      },
    ],
    contentFingerprints: [createFingerprint("content-url", entry.url)],
    externalId: entry.url,
    kind: "article",
    publishedAt: entry.publishedAt,
    status: "discovered",
    summary: joinNonEmptyParts([
      entry.publishedAtText,
      entry.category,
      entry.title,
    ]),
    title: entry.title,
  };
}

function readLastProcessedUrl(
  collectorPluginState: JsonObject | undefined,
): string | null {
  const candidate = collectorPluginState?.lastProcessedUrl;

  return typeof candidate === "string" && candidate.length > 0
    ? candidate
    : null;
}

function parsePublishedAt(value: string | null): Date | null {
  if (value === null) {
    return null;
  }

  const normalized = `${value}T00:00:00Z`;
  const date = new Date(normalized);

  return Number.isNaN(date.getTime()) ? null : date;
}

function stripGovOnlineTitleSuffix(title: string | null): string | null {
  if (title === null) {
    return null;
  }

  const [headline] = title.split("|");

  return normalizeWhitespace(headline);
}

function normalizeInfoPath(pathname: string): string {
  if (pathname === "/info") {
    return "/info/";
  }

  return pathname;
}

function safeResolveUrl(url: string, sourceUrl: string): string | null {
  try {
    return new URL(url, sourceUrl).toString();
  } catch {
    return null;
  }
}

function createFingerprint(prefix: string, value: string): string {
  return `${prefix}:${value}`;
}

function joinNonEmptyParts(parts: Array<string | null>): string | null {
  const normalizedParts = parts.filter(
    (part): part is string => part !== null && part.length > 0,
  );

  return normalizedParts.length > 0 ? normalizedParts.join(" ") : null;
}

function normalizeWhitespace(value: string | null | undefined): string | null {
  const normalized = value
    ?.replaceAll(/<br\s*\/?>/gi, " ")
    .replaceAll(/\s+/g, " ")
    .trim();

  return normalized ? normalized : null;
}

function firstMatch(body: string, pattern: RegExp): string | null {
  const match = body.match(pattern);

  return match?.[1] ?? null;
}

function stripTags(value: string): string {
  return value.replaceAll(/<[^>]+>/g, "");
}

function decodeHtmlEntities(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&nbsp;", " ");
}

function normalizeContentType(
  value: string | null,
  defaultValue: string,
): string {
  const normalized = value?.split(";")[0]?.trim();

  return normalized && normalized.length > 0 ? normalized : defaultValue;
}
