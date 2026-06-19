import { describe, expect, it, vi } from "vitest";

import { podcastRssPlugin } from "../../../../src/plugins/collector/podcast-rss/plugin.js";

function createPluginContext() {
  return {
    getHost() {
      return {
        logger: {
          child() {
            return this;
          },
          error: vi.fn(),
          info: vi.fn(),
          warn: vi.fn(),
        },
      };
    },
  };
}

describe("podcastRssPlugin.discover", () => {
  it("returns a direct RSS feed as a single candidate", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            `<?xml version="1.0"?><rss><channel><title>Example Podcast</title><description>Weekly notes</description></channel></rss>`,
            { status: 200 },
          ),
        ),
      ),
    );

    const result = await podcastRssPlugin.discover?.(
      {
        abortSignal: new AbortController().signal,
        config: {},
        inputUrl: "https://example.com/feed.xml",
      },
      createPluginContext() as never,
    );

    expect(result?.candidates).toHaveLength(1);
    expect(result?.candidates[0]).toMatchObject({
      description: "Weekly notes",
      title: "Example Podcast",
      url: "https://example.com/feed.xml",
    });
    expect(result?.candidates[0]?.sourceSlug).toMatch(/^example-podcast/);
  });

  it("returns a direct Atom podcast feed as a single candidate", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            `<?xml version="1.0"?>
            <feed xmlns="http://www.w3.org/2005/Atom">
              <title>Example Podcast</title>
              <subtitle>Weekly notes</subtitle>
              <entry>
                <id>tag:example.com,2026:episode-1</id>
                <link href="https://example.com/episodes/1" />
                <link
                  rel="enclosure"
                  type="audio/mpeg"
                  href="https://cdn.example.com/audio/1.mp3"
                />
              </entry>
            </feed>`,
            { status: 200 },
          ),
        ),
      ),
    );

    const result = await podcastRssPlugin.discover?.(
      {
        abortSignal: new AbortController().signal,
        config: {},
        inputUrl: "https://example.com/feed.xml",
      },
      createPluginContext() as never,
    );

    expect(result?.candidates).toHaveLength(1);
    expect(result?.candidates[0]).toMatchObject({
      description: "Weekly notes",
      title: "Example Podcast",
      url: "https://example.com/feed.xml",
    });
  });

  it("does not accept non-podcast Atom feeds as podcast candidates", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            `<?xml version="1.0"?>
            <feed xmlns="http://www.w3.org/2005/Atom">
              <title>Example Site Feed</title>
              <subtitle>Notes</subtitle>
              <entry>
                <id>tag:example.com,2026:entry-1</id>
                <link href="https://example.com/posts/1" />
              </entry>
            </feed>`,
            { status: 200 },
          ),
        ),
      ),
    );

    const result = await podcastRssPlugin.discover?.(
      {
        abortSignal: new AbortController().signal,
        config: {},
        inputUrl: "https://example.com/feed.xml",
      },
      createPluginContext() as never,
    );

    expect(result?.candidates).toEqual([]);
  });
});

describe("podcastRssPlugin.preview", () => {
  it("returns the first observed items as preview data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            `<?xml version="1.0"?><rss><channel><title>Example Podcast</title><item><guid>1</guid><title>Episode 1</title><description>Summary 1</description><enclosure url="https://cdn.example.com/1.mp3"/></item></channel></rss>`,
            { status: 200 },
          ),
        ),
      ),
    );

    const result = await podcastRssPlugin.preview?.(
      {
        abortSignal: new AbortController().signal,
        config: {},
        sourceUrl: "https://example.com/feed.xml",
      },
      createPluginContext() as never,
    );

    expect(result?.items).toHaveLength(1);
    expect(result?.items[0]).toMatchObject({
      title: "Episode 1",
    });
  });

  it("returns preview data from Atom podcast entries", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            `<?xml version="1.0"?>
            <feed xmlns="http://www.w3.org/2005/Atom">
              <title>Example Podcast</title>
              <entry>
                <id>tag:example.com,2026:episode-1</id>
                <title>Episode 1</title>
                <summary>Summary 1</summary>
                <updated>2024-01-01T00:00:00Z</updated>
                <link rel="enclosure" type="audio/mpeg" href="https://cdn.example.com/1.mp3" />
              </entry>
            </feed>`,
            { status: 200 },
          ),
        ),
      ),
    );

    const result = await podcastRssPlugin.preview?.(
      {
        abortSignal: new AbortController().signal,
        config: {},
        sourceUrl: "https://example.com/feed.xml",
      },
      createPluginContext() as never,
    );

    expect(result?.items).toHaveLength(1);
    expect(result?.items[0]).toMatchObject({
      publishedAt: new Date("2024-01-01T00:00:00.000Z"),
      summary: "Summary 1",
      title: "Episode 1",
    });
  });
});
