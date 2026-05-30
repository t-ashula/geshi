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
});
