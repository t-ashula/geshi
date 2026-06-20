import { describe, expect, it, vi } from "vitest";

import { rssPlugin } from "../../../../src/plugins/collector/rss/plugin.js";

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

describe("rssPlugin.discover", () => {
  it("returns a direct RSS feed as a single candidate", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            `<?xml version="1.0"?><rss><channel><title>Example Feed</title><description>Weekly notes</description></channel></rss>`,
            { status: 200 },
          ),
        ),
      ),
    );

    const result = await rssPlugin.discover?.(
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
      title: "Example Feed",
      url: "https://example.com/feed.xml",
    });
    expect(result?.candidates[0]?.sourceSlug).toMatch(/^example-feed/);
  });

  it("returns a direct RDF feed as a single candidate", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            `<?xml version="1.0"?>
            <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
              <channel>
                <title>Example RDF Feed</title>
                <description>RDF notes</description>
              </channel>
              <item>
                <title>Entry 1</title>
                <link>https://example.com/posts/1</link>
              </item>
            </rdf:RDF>`,
            { status: 200 },
          ),
        ),
      ),
    );

    const result = await rssPlugin.discover?.(
      {
        abortSignal: new AbortController().signal,
        config: {},
        inputUrl: "https://example.com/feed.rdf",
      },
      createPluginContext() as never,
    );

    expect(result?.candidates).toHaveLength(1);
    expect(result?.candidates[0]).toMatchObject({
      description: "RDF notes",
      title: "Example RDF Feed",
      url: "https://example.com/feed.rdf",
    });
  });

  it("returns a direct Atom feed as a single candidate", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            `<?xml version="1.0"?>
            <feed xmlns="http://www.w3.org/2005/Atom">
              <title>Example Atom Feed</title>
              <subtitle>Atom notes</subtitle>
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

    const result = await rssPlugin.discover?.(
      {
        abortSignal: new AbortController().signal,
        config: {},
        inputUrl: "https://example.com/feed.xml",
      },
      createPluginContext() as never,
    );

    expect(result?.candidates).toHaveLength(1);
    expect(result?.candidates[0]).toMatchObject({
      description: "Atom notes",
      title: "Example Atom Feed",
      url: "https://example.com/feed.xml",
    });
  });

  it("discovers multiple feed candidates from an html feed listing page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = input instanceof Request ? input.url : input.toString();

        if (url === "https://example.com/rss") {
          return Promise.resolve(
            new Response(
              `<html><body>
                <a href="/feeds/main.rdf">Main RDF</a>
                <a href="/feeds/sub.xml">Sub RSS</a>
              </body></html>`,
              { status: 200 },
            ),
          );
        }

        if (url === "https://example.com/feeds/main.rdf") {
          return Promise.resolve(
            new Response(
              `<?xml version="1.0"?><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><channel><title>Main RDF</title><description>Main feed</description></channel><item><title>A</title><link>https://example.com/a</link></item></rdf:RDF>`,
              { status: 200 },
            ),
          );
        }

        return Promise.resolve(
          new Response(
            `<?xml version="1.0"?><rss><channel><title>Sub RSS</title><description>Sub feed</description></channel></rss>`,
            { status: 200 },
          ),
        );
      }),
    );

    const result = await rssPlugin.discover?.(
      {
        abortSignal: new AbortController().signal,
        config: {},
        inputUrl: "https://example.com/rss",
      },
      createPluginContext() as never,
    );

    expect(result?.candidates).toHaveLength(2);
    expect(result?.candidates.map((candidate) => candidate.url)).toEqual([
      "https://example.com/feeds/main.rdf",
      "https://example.com/feeds/sub.xml",
    ]);
  });

  it("discovers rss alternate links from an article page without mixing mobile alternates", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = input instanceof Request ? input.url : input.toString();

        if (url === "https://example.com/articles/1") {
          return Promise.resolve(
            new Response(
              `<html><head>
                <link rel="alternate" media="only screen and (max-width: 640px)" href="https://example.com/spv/articles/1" />
                <link rel="alternate" type="application/rss+xml" title="Example Feed" href="https://example.com/rss/news.xml" />
              </head><body></body></html>`,
              { status: 200 },
            ),
          );
        }

        return Promise.resolve(
          new Response(
            `<?xml version="1.0"?><rss><channel><title>Example Feed</title><description>Latest entries</description></channel></rss>`,
            { status: 200 },
          ),
        );
      }),
    );

    const result = await rssPlugin.discover?.(
      {
        abortSignal: new AbortController().signal,
        config: {},
        inputUrl: "https://example.com/articles/1",
      },
      createPluginContext() as never,
    );

    expect(result?.candidates).toHaveLength(1);
    expect(result?.candidates[0]).toMatchObject({
      title: "Example Feed",
      url: "https://example.com/rss/news.xml",
    });
  });
});

describe("rssPlugin.preview", () => {
  it("returns the first observed items as preview data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            `<?xml version="1.0"?><rss><channel><title>Example Feed</title><item><guid>1</guid><title>Entry 1</title><description>Summary 1</description></item><item><guid>2</guid><title>Entry 2</title><description>Summary 2</description></item></channel></rss>`,
            { status: 200 },
          ),
        ),
      ),
    );

    const result = await rssPlugin.preview?.(
      {
        abortSignal: new AbortController().signal,
        config: {},
        sourceUrl: "https://example.com/feed.xml",
      },
      createPluginContext() as never,
    );

    expect(result?.items).toHaveLength(2);
    expect(result?.items[0]).toMatchObject({
      title: "Entry 1",
    });
  });

  it("returns preview data from Atom entries", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            `<?xml version="1.0"?>
            <feed xmlns="http://www.w3.org/2005/Atom">
              <title>Example Atom Feed</title>
              <entry>
                <id>tag:example.com,2026:entry-1</id>
                <title>Entry 1</title>
                <summary>Summary 1</summary>
                <updated>2024-01-01T00:00:00Z</updated>
              </entry>
            </feed>`,
            { status: 200 },
          ),
        ),
      ),
    );

    const result = await rssPlugin.preview?.(
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
      title: "Entry 1",
    });
  });
});
