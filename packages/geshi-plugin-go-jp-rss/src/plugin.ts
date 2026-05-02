import type {
  AcquiredAsset,
  ObservedContent,
  SourceCollectorAcquireInput,
  SourceCollectorInspectErrorCode,
  SourceCollectorInspectInput,
  SourceCollectorObserveInput,
  SourceCollectorPlugin,
  SourceMetadata,
} from "../../geshi-plugin-api/src/index.js";

class SourceCollectorInspectPluginError extends Error {
  public readonly code: SourceCollectorInspectErrorCode;

  public constructor(code: SourceCollectorInspectErrorCode, message: string) {
    super(message);
    this.name = "SourceCollectorInspectPluginError";
    this.code = code;
  }
}

export const goJpRssPlugin: SourceCollectorPlugin = {
  pluginSlug: "go-jp-rss",
  sourceKind: "feed",

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
    const metadata = parseHtmlMetadata(body);

    if (metadata === null) {
      throw new SourceCollectorInspectPluginError(
        "source_inspect_unrecognized",
        "The given URL is not a supported HTML source.",
      );
    }

    return {
      description: metadata.description,
      title: metadata.title,
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
      throw new Error(`Failed to fetch HTML source: ${response.status}`);
    }

    const body = await response.text();
    const entries = parseHtmlEntries(body, input.sourceUrl);

    return entries.map((entry) => ({
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
      publishedAt: null,
      status: "discovered",
      summary: null,
      title: entry.title,
    }));
  },

  async acquire(input: SourceCollectorAcquireInput): Promise<AcquiredAsset> {
    if (input.asset.sourceUrl === null) {
      throw new Error("HTML source asset sourceUrl is required.");
    }

    const response = await fetch(input.asset.sourceUrl, {
      signal: input.abortSignal,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch asset: ${response.status}`);
    }

    const body = new Uint8Array(await response.arrayBuffer());
    const contentType = normalizeContentType(
      response.headers.get("content-type"),
      "text/html",
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

type HtmlMetadata = Pick<SourceMetadata, "description" | "title">;

type HtmlEntry = {
  title: string | null;
  url: string;
};

function parseHtmlMetadata(body: string): HtmlMetadata | null {
  const title = normalizeWhitespace(
    firstMatch(body, /<title[^>]*>(.*?)<\/title>/isu),
  );
  const description = normalizeWhitespace(
    firstMatch(
      body,
      /<meta[^>]+name=["']description["'][^>]+content=["'](.*?)["'][^>]*>/isu,
    ) ??
      firstMatch(
        body,
        /<meta[^>]+content=["'](.*?)["'][^>]+name=["']description["'][^>]*>/isu,
      ),
  );

  if (title === null && description === null) {
    return null;
  }

  return {
    description,
    title,
  };
}

function parseHtmlEntries(body: string, sourceUrl: string): HtmlEntry[] {
  const matches = body.matchAll(/<a[^>]+href=["'](.*?)["'][^>]*>(.*?)<\/a>/gis);
  const entries: HtmlEntry[] = [];
  const seenUrls = new Set<string>();

  for (const match of matches) {
    const href = normalizeWhitespace(match[1]);
    const title = normalizeWhitespace(stripTags(match[2] ?? ""));

    if (href === null || href.startsWith("#")) {
      continue;
    }

    let resolvedUrl: string;

    try {
      resolvedUrl = new URL(href, sourceUrl).toString();
    } catch {
      continue;
    }

    if (resolvedUrl === sourceUrl || seenUrls.has(resolvedUrl)) {
      continue;
    }

    seenUrls.add(resolvedUrl);
    entries.push({
      title,
      url: resolvedUrl,
    });
  }

  return entries;
}

function createFingerprint(prefix: string, value: string): string {
  return `${prefix}:${value}`;
}

function normalizeWhitespace(value: string | null | undefined): string | null {
  const normalized = value?.replaceAll(/\s+/g, " ").trim();

  return normalized ? normalized : null;
}

function firstMatch(body: string, pattern: RegExp): string | null {
  const match = body.match(pattern);

  return match?.[1] ?? null;
}

function stripTags(value: string): string {
  return value.replaceAll(/<[^>]+>/g, "");
}

function normalizeContentType(
  value: string | null,
  defaultValue: string,
): string {
  const normalized = value?.split(";")[0]?.trim();

  return normalized && normalized.length > 0 ? normalized : defaultValue;
}
