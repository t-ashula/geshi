import { XMLParser } from "fast-xml-parser";

import type {
  AcquiredAsset,
  ObservedContent,
  SourceCollectorAcquireInput,
  SourceCollectorObserveInput,
  SourceCollectorPlugin,
} from "../types.js";

type RssChannel = {
  item?: RssItem | RssItem[];
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

export const podcastRssPlugin: SourceCollectorPlugin = {
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
    const parsedFeed = parser.parse(body) as RssFeed;
    const channel = parsedFeed.rss?.channel;
    const items = toArray(channel?.item);

    return items
      .map(toObservedContent)
      .filter((item): item is ObservedContent => item !== null);
  },

  acquire(_input: SourceCollectorAcquireInput): Promise<AcquiredAsset[]> {
    return Promise.reject(new Error("podcast-rss acquire is not implemented."));
  },
};

function toObservedContent(item: RssItem): ObservedContent | null {
  const externalId =
    normalizeString(readGuid(item.guid)) ??
    normalizeString(item.link) ??
    normalizeString(item.enclosure?.["@_url"]);

  if (externalId === null) {
    return null;
  }

  return {
    externalId,
    kind: "podcast-episode",
    publishedAt: parsePublishedAt(item.pubDate),
    status: "discovered",
    summary: normalizeString(item.description),
    title: normalizeString(item.title),
  };
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

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}
