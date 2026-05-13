import { createHash } from "node:crypto";

import type {
  AcquiredAsset,
  ExtractedDetailBody,
  JsonObject,
  ObservedContent,
  SourceCollectorAcquireInput,
  SourceCollectorExtractInput,
  SourceCollectorInspectErrorCode,
  SourceCollectorInspectInput,
  SourceCollectorObserveInput,
  SourceCollectorObserveResult,
  SourceCollectorPlugin,
  SourceCollectorPluginDefinition,
  SourceCollectorSupportsInput,
  SourceMetadata,
} from "@geshi/sdk";
import type { DefaultTreeAdapterTypes } from "parse5";
import { parse } from "parse5";

import { extractHtmlDetailBody } from "./html-detail-body.js";
import { manifest } from "./manifest.js";

const DEFAULT_CONTENT_TYPE = "text/html";
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.000.0 Safari/537.36";
const GOV_ONLINE_HOST = "www.gov-online.go.jp";
const GOV_ONLINE_INFO_PATHS = new Set(["/info/", "/info/index.html"]);
const MAX_ITEMS = 40;
const ONE_WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000;
const TEXT_DECODER_FALLBACK_ENCODING = "utf-8";
const META_CHARSET_SCAN_LENGTH = 2048;
const FINGERPRINT_VERSION = "2026-05-13";

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

  settingSchema() {
    return [];
  },

  async inspect(input: SourceCollectorInspectInput) {
    assertSupportedSourceUrl(input.sourceUrl);

    const page = await fetchGovOnlinePage(
      input.context,
      input.sourceUrl,
      input.abortSignal,
    );

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
      const page = await fetchGovOnlinePage(
        input.context,
        currentUrl,
        input.abortSignal,
      );

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

  extract(
    input: SourceCollectorExtractInput,
  ): Promise<ExtractedDetailBody | null> {
    if (input.asset.kind !== "html") {
      return Promise.resolve(null);
    }

    const html = decodeHtmlDocument(input.asset.body, input.asset.mimeType);

    return Promise.resolve(extractHtmlDetailBody(html, input.asset.sourceUrl));
  },

  async acquire(input: SourceCollectorAcquireInput): Promise<AcquiredAsset> {
    if (input.asset.sourceUrl === null) {
      throw new Error("go-jp-rss asset sourceUrl is required.");
    }

    const webClient = await input.context.getWebClient({
      kind: "fetch",
    });
    const response = await webClient.fetch(
      new Request(input.asset.sourceUrl, {
        headers: {
          "User-Agent": DEFAULT_USER_AGENT,
        },
        signal: input.abortSignal,
      }),
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch asset: ${response.status}`);
    }

    const body = new Uint8Array(await response.arrayBuffer());
    const html = decodeHtmlDocument(body, response.headers.get("content-type"));
    const normalizedBody = new TextEncoder().encode(html);
    const contentType = normalizeContentType(
      response.headers.get("content-type"),
      DEFAULT_CONTENT_TYPE,
    );

    return {
      acquiredFingerprints: createAcquiredAssetFingerprints(
        input.asset.sourceUrl,
        normalizedBody,
      ),
      body: normalizedBody,
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
  context: SourceCollectorInspectInput["context"],
  sourceUrl: string,
  abortSignal: AbortSignal,
): Promise<GovOnlinePage> {
  const webClient = await context.getWebClient({
    kind: "fetch",
  });
  let response: Response;

  try {
    response = await webClient.fetch(
      new Request(sourceUrl, {
        headers: {
          "User-Agent": DEFAULT_USER_AGENT,
        },
        signal: abortSignal,
      }),
    );
  } catch {
    throw new SourceCollectorInspectPluginError(
      "source_inspect_fetch_failed",
      "Failed to fetch gov-online source.",
    );
  }

  if (!response.ok) {
    throw new SourceCollectorInspectPluginError(
      "source_inspect_fetch_failed",
      "Failed to fetch gov-online source.",
    );
  }

  const body = decodeHtmlDocument(
    new Uint8Array(await response.arrayBuffer()),
    response.headers.get("content-type"),
  );

  return parseGovOnlinePage(body, sourceUrl);
}

function parseGovOnlinePage(body: string, sourceUrl: string): GovOnlinePage {
  const document = parse(body);

  return {
    entries: parseGovOnlineEntries(document, sourceUrl),
    metadata: parseGovOnlineMetadata(document),
    nextPageUrl: parseNextPageUrl(document, sourceUrl),
  };
}

function parseGovOnlineMetadata(
  document: DefaultTreeAdapterTypes.Document,
): Pick<SourceMetadata, "description" | "title"> {
  const titleNode = findFirstElementByTagName(document, "title");
  const pageTitle = normalizeWhitespace(extractTextContent(titleNode));
  const descriptionNode = findElementsByTagName(document, "meta").find(
    (node) => {
      const attributes = readNodeAttributes(node);

      return attributes.name?.toLowerCase() === "description";
    },
  );
  const description = normalizeWhitespace(
    descriptionNode === undefined
      ? null
      : (readNodeAttributes(descriptionNode).content ?? null),
  );

  return {
    description,
    title: stripGovOnlineTitleSuffix(pageTitle),
  };
}

function parseGovOnlineEntries(
  document: DefaultTreeAdapterTypes.Document,
  sourceUrl: string,
): GovOnlineEntry[] {
  const entries: GovOnlineEntry[] = [];

  for (const itemNode of findElementsByClassName(
    document,
    "p-newsList__item",
  )) {
    if (itemNode.tagName !== "li") {
      continue;
    }

    const linkNode = findFirstDescendant(
      itemNode,
      (node) => node.tagName === "a" && hasClassName(node, "p-newsList__link"),
    );
    const href = normalizeWhitespace(
      linkNode === null ? null : (readNodeAttributes(linkNode).href ?? null),
    );

    if (href === null) {
      continue;
    }

    const resolvedUrl = safeResolveUrl(href, sourceUrl);

    if (resolvedUrl === null) {
      continue;
    }

    const title = normalizeWhitespace(
      extractTextContent(
        findFirstDescendant(
          itemNode,
          (node) =>
            node.tagName === "span" && hasClassName(node, "p-newsList__title"),
        ),
      ),
    );
    const category = normalizeWhitespace(
      extractTextContent(
        findFirstDescendant(
          itemNode,
          (node) =>
            node.tagName === "span" &&
            hasClassName(node, "p-newsList__categoryLabel"),
        ),
      ),
    );
    const publishedAtNode = findFirstDescendant(
      itemNode,
      (node) =>
        node.tagName === "time" && hasClassName(node, "p-newsList__date"),
    );
    const publishedAtValue = normalizeWhitespace(
      publishedAtNode === null
        ? null
        : (readNodeAttributes(publishedAtNode).datetime ?? null),
    );
    const publishedAtText = normalizeWhitespace(
      extractTextContent(publishedAtNode),
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

function parseNextPageUrl(
  document: DefaultTreeAdapterTypes.Document,
  sourceUrl: string,
): string | null {
  const paginationNode = findFirstDescendant(
    document,
    (node) =>
      node.tagName === "div" && hasClassName(node, "p-pagination__next"),
  );
  const nextPageLinkNode =
    paginationNode === null
      ? null
      : findFirstDescendant(paginationNode, (node) => node.tagName === "a");
  const nextPageHref = normalizeWhitespace(
    nextPageLinkNode === null
      ? null
      : (readNodeAttributes(nextPageLinkNode).href ?? null),
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
        nextAction: {
          actionKind: "acquire",
        },
        observedFingerprints: createObservedAssetFingerprints(entry.url),
        primary: true,
        sourceUrl: entry.url,
      },
    ],
    contentFingerprints: createContentFingerprints(entry),
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

function joinNonEmptyParts(parts: Array<string | null>): string | null {
  const normalizedParts = parts.filter(
    (part): part is string => part !== null && part.length > 0,
  );

  return normalizedParts.length > 0 ? normalizedParts.join(" ") : null;
}

function normalizeWhitespace(value: string | null | undefined): string | null {
  const normalized = (value ?? "").replaceAll(/\s+/g, " ").trim();

  return normalized ? normalized : null;
}

function normalizeContentType(
  value: string | null,
  defaultValue: string,
): string {
  const normalized = value?.split(";")[0]?.trim();

  return normalized && normalized.length > 0 ? normalized : defaultValue;
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
  const document = parse(scanBody);

  for (const metaNode of findElementsByTagName(document, "meta")) {
    const attributes = readNodeAttributes(metaNode);
    const charset = normalizeEncodingLabel(attributes.charset ?? null);

    if (charset !== null) {
      return charset;
    }

    if (attributes["http-equiv"]?.toLowerCase() !== "content-type") {
      continue;
    }

    const contentCharset = extractCharsetFromContentType(
      attributes.content ?? null,
    );

    if (contentCharset !== null) {
      return contentCharset;
    }
  }

  return null;
}

function normalizeEncodingLabel(value: string | null): string | null {
  const normalized = value?.trim().toLowerCase();

  return normalized && normalized.length > 0 ? normalized : null;
}

function createContentFingerprints(entry: GovOnlineEntry): string[] {
  const legacyValue = createLegacyFingerprint("content-url", entry.url);

  return [createVersionedFingerprint(legacyValue), legacyValue];
}

function createObservedAssetFingerprints(sourceUrl: string): string[] {
  const legacyValue = createLegacyFingerprint("observed-html-url", sourceUrl);

  return [createVersionedFingerprint(legacyValue), legacyValue];
}

function createAcquiredAssetFingerprints(
  sourceUrl: string | null,
  body: Uint8Array,
): string[] {
  const legacyValue = createLegacyFingerprint(
    "acquired-html",
    `${sourceUrl ?? ""}:${body.byteLength}`,
  );

  return [createVersionedFingerprint(legacyValue), legacyValue];
}

function createVersionedFingerprint(value: string): string {
  return `${FINGERPRINT_VERSION}:${sha256Hex(value)}`;
}

function createLegacyFingerprint(prefix: string, value: string): string {
  return `${prefix}:${value}`;
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function findElementsByTagName(
  root: DefaultTreeAdapterTypes.ParentNode | DefaultTreeAdapterTypes.ChildNode,
  tagName: string,
): DefaultTreeAdapterTypes.Element[] {
  const nodes: DefaultTreeAdapterTypes.Element[] = [];

  visitNode(root, (node) => {
    if (isElement(node) && node.tagName === tagName) {
      nodes.push(node);
    }
  });

  return nodes;
}

function findFirstElementByTagName(
  root: DefaultTreeAdapterTypes.ParentNode | DefaultTreeAdapterTypes.ChildNode,
  tagName: string,
): DefaultTreeAdapterTypes.Element | null {
  return findFirstDescendant(root, (node) => node.tagName === tagName);
}

function findElementsByClassName(
  root: DefaultTreeAdapterTypes.ParentNode | DefaultTreeAdapterTypes.ChildNode,
  className: string,
): DefaultTreeAdapterTypes.Element[] {
  const nodes: DefaultTreeAdapterTypes.Element[] = [];

  visitNode(root, (node) => {
    if (isElement(node) && hasClassName(node, className)) {
      nodes.push(node);
    }
  });

  return nodes;
}

function findFirstDescendant(
  root:
    | DefaultTreeAdapterTypes.ParentNode
    | DefaultTreeAdapterTypes.ChildNode
    | null,
  predicate: (node: DefaultTreeAdapterTypes.Element) => boolean,
): DefaultTreeAdapterTypes.Element | null {
  if (root === null) {
    return null;
  }

  if (isElement(root) && predicate(root)) {
    return root;
  }

  for (const childNode of getChildNodes(root)) {
    const match = findFirstDescendant(childNode, predicate);

    if (match !== null) {
      return match;
    }
  }

  return null;
}

function visitNode(
  root: DefaultTreeAdapterTypes.ParentNode | DefaultTreeAdapterTypes.ChildNode,
  visitor: (
    node:
      | DefaultTreeAdapterTypes.ParentNode
      | DefaultTreeAdapterTypes.ChildNode,
  ) => void,
): void {
  visitor(root);

  for (const childNode of getChildNodes(root)) {
    visitNode(childNode, visitor);
  }
}

function readNodeAttributes(
  node: DefaultTreeAdapterTypes.Element,
): Record<string, string> {
  return Object.fromEntries(
    node.attrs.map((attribute) => [attribute.name, attribute.value]),
  );
}

function hasClassName(
  node: DefaultTreeAdapterTypes.Element,
  className: string,
): boolean {
  const classes = readNodeAttributes(node).class;

  return classes?.split(/\s+/).includes(className) ?? false;
}

function extractTextContent(
  root:
    | DefaultTreeAdapterTypes.ParentNode
    | DefaultTreeAdapterTypes.ChildNode
    | null,
): string {
  if (root === null) {
    return "";
  }

  const segments: string[] = [];

  visitNode(root, (node) => {
    if (isTextNode(node)) {
      segments.push(node.value);
    }
  });

  return segments.join(" ");
}

function isElement(
  node: DefaultTreeAdapterTypes.ParentNode | DefaultTreeAdapterTypes.ChildNode,
): node is DefaultTreeAdapterTypes.Element {
  return "tagName" in node;
}

function isTextNode(
  node: DefaultTreeAdapterTypes.ParentNode | DefaultTreeAdapterTypes.ChildNode,
): node is DefaultTreeAdapterTypes.TextNode {
  return node.nodeName === "#text";
}

function getChildNodes(
  node: DefaultTreeAdapterTypes.ParentNode | DefaultTreeAdapterTypes.ChildNode,
): DefaultTreeAdapterTypes.ChildNode[] {
  return "childNodes" in node ? node.childNodes : [];
}
