import { XMLParser } from "fast-xml-parser";

type AtomFeed = {
  feed?: {
    entry?: AtomEntry | AtomEntry[];
    subtitle?: AtomTextNode;
    title?: AtomTextNode;
  };
};

type AtomEntry = {
  content?: AtomTextNode;
  id?: AtomTextNode;
  link?: AtomLinkNode | AtomLinkNode[];
  published?: AtomTextNode;
  summary?: AtomTextNode;
  title?: AtomTextNode;
  updated?: AtomTextNode;
};

type AtomLinkNode = {
  "@_href"?: string;
  "@_rel"?: string;
  "@_type"?: string;
};

type AtomTextNode = string | { "#text"?: string };

export type NormalizedFeedEnclosure = {
  "@_type"?: string;
  "@_url"?: string;
};

export type NormalizedFeedItem = {
  description?: string;
  enclosure?: NormalizedFeedEnclosure;
  guid?: string;
  link?: string;
  pubDate?: string;
  title?: string;
};

export type ParsedAtomFeed = {
  items: NormalizedFeedItem[];
  metadata: {
    description: string | null;
    title: string | null;
  };
};

const parser = new XMLParser({
  attributeNamePrefix: "@_",
  ignoreAttributes: false,
  parseTagValue: false,
  trimValues: true,
});

export function parseAtomFeed(
  value: string,
  options: {
    requireAudioEnclosure?: boolean;
  } = {},
): ParsedAtomFeed | null {
  const parsedFeed = parser.parse(value) as AtomFeed;
  const feed = parsedFeed.feed;

  if (feed === undefined) {
    return null;
  }

  const items = toArray(feed.entry).map(normalizeAtomEntry);

  if (
    options.requireAudioEnclosure === true &&
    !items.some((item) => item.enclosure?.["@_type"]?.startsWith("audio/"))
  ) {
    return null;
  }

  return {
    items,
    metadata: {
      description: normalizeTextNode(feed.subtitle),
      title: normalizeTextNode(feed.title),
    },
  };
}

function normalizeAtomEntry(entry: AtomEntry): NormalizedFeedItem {
  const links = toArray(entry.link);
  const pageLink = selectPageLink(links);
  const enclosureLink = selectEnclosureLink(links);

  return {
    description:
      normalizeTextNode(entry.summary) ??
      normalizeTextNode(entry.content) ??
      undefined,
    enclosure:
      enclosureLink === undefined
        ? undefined
        : {
            "@_type": normalizeString(enclosureLink["@_type"]) ?? undefined,
            "@_url": normalizeString(enclosureLink["@_href"]) ?? undefined,
          },
    guid: normalizeTextNode(entry.id) ?? undefined,
    link: normalizeString(pageLink?.["@_href"]) ?? undefined,
    pubDate:
      normalizeTextNode(entry.published) ??
      normalizeTextNode(entry.updated) ??
      undefined,
    title: normalizeTextNode(entry.title) ?? undefined,
  };
}

function selectPageLink(links: AtomLinkNode[]): AtomLinkNode | undefined {
  return links.find((link) => {
    const rel = normalizeString(link["@_rel"]);

    return rel === null || rel === "alternate";
  });
}

function selectEnclosureLink(links: AtomLinkNode[]): AtomLinkNode | undefined {
  return links.find((link) => normalizeString(link["@_rel"]) === "enclosure");
}

function normalizeTextNode(value: AtomTextNode | undefined): string | null {
  if (typeof value === "string") {
    return normalizeString(value);
  }

  return normalizeString(value?.["#text"]);
}

function normalizeString(value: string | undefined): string | null {
  const normalizedValue = value?.trim();

  return normalizedValue ? normalizedValue : null;
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}
