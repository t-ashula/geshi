import { parse } from "parse5";

type Parse5Attribute = {
  name: string;
  value: string;
};

type Parse5Node = {
  attrs?: Parse5Attribute[];
  childNodes?: Parse5Node[];
  tagName?: string;
};

const FEED_MIME_TYPES = new Set([
  "application/atom+xml",
  "application/rdf+xml",
  "application/rss+xml",
  "application/xml",
  "text/xml",
]);

export function extractDiscoveredFeedUrls(
  body: string,
  baseUrl: string,
): string[] {
  const document = parse(body) as Parse5Node;
  const urls = new Set<string>();

  visitNode(document, (node) => {
    const tagName = node.tagName?.toLowerCase();

    if (tagName !== "a" && tagName !== "link") {
      return;
    }

    const attributes = readNodeAttributes(node);
    const href = attributes.href;

    if (href === undefined || href.trim() === "") {
      return;
    }

    if (tagName === "a") {
      if (!isLikelyFeedUrl(href, baseUrl)) {
        return;
      }
    } else {
      if (!isAlternateFeedLink(attributes, href, baseUrl)) {
        return;
      }
    }

    try {
      urls.add(new URL(href, baseUrl).toString());
    } catch {
      return;
    }
  });

  return [...urls];
}

function isAlternateFeedLink(
  attributes: Record<string, string>,
  href: string,
  baseUrl: string,
): boolean {
  const rel = attributes.rel;

  if (rel === undefined) {
    return false;
  }

  const relTokens = rel
    .split(/\s+/)
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token !== "");

  if (!relTokens.includes("alternate")) {
    return false;
  }

  const type = attributes.type?.trim().toLowerCase();

  return (
    (type !== undefined && FEED_MIME_TYPES.has(type)) ||
    isLikelyFeedUrl(href, baseUrl)
  );
}

function isLikelyFeedUrl(href: string, baseUrl: string): boolean {
  let resolvedUrl: URL;

  try {
    resolvedUrl = new URL(href, baseUrl);
  } catch {
    return false;
  }

  const pathname = resolvedUrl.pathname.toLowerCase();

  return (
    pathname.endsWith(".xml") ||
    pathname.endsWith(".rdf") ||
    pathname.includes("/feed") ||
    pathname.includes("/rss/")
  );
}

function readNodeAttributes(node: Parse5Node): Record<string, string> {
  return Object.fromEntries(
    (node.attrs ?? []).map((attribute) => [attribute.name, attribute.value]),
  );
}

function visitNode(
  root: Parse5Node,
  visitor: (node: Parse5Node) => void,
): void {
  visitor(root);

  for (const childNode of root.childNodes ?? []) {
    visitNode(childNode, visitor);
  }
}
