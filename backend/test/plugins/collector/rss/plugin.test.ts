import { describe, expect, it, vi } from "vitest";

import { createNoopLogger } from "../../../../src/logger/index.js";
import { rssPlugin } from "../../../../src/plugins/collector/rss/plugin.js";

function createPluginContext() {
  return {
    getHost() {
      return {
        logger: createNoopLogger(),
      };
    },
  };
}

describe("rssPlugin.observe", () => {
  it("builds feed entries from item links and enclosures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            `<?xml version="1.0"?>
            <rss>
              <channel>
                <item>
                  <guid>entry-1</guid>
                  <title> Entry 1 </title>
                  <description> Hello </description>
                  <link> https://example.com/posts/1 </link>
                  <enclosure
                    type="audio/mpeg"
                    url="https://cdn.example.com/audio/1.mp3"
                  />
                  <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
                </item>
              </channel>
            </rss>`,
            { status: 200 },
          ),
        ),
      ),
    );

    const result = await rssPlugin.observe(
      {
        abortSignal: new AbortController().signal,
        config: {},
        sourceUrl: "https://example.com/feed.xml",
      },
      createPluginContext(),
    );

    expect(result.contents).toHaveLength(1);
    expect(result.contents[0]).toMatchObject({
      externalId: "entry-1",
      kind: "feed-entry",
      publishedAt: new Date("2024-01-01T00:00:00.000Z"),
      status: "discovered",
      summary: "Hello",
      title: "Entry 1",
    });
    expect(result.contents[0]?.assets).toEqual([
      expect.objectContaining({
        kind: "html",
        nextAction: {
          actionKind: "acquire",
        },
        primary: true,
        sourceUrl: "https://example.com/posts/1",
      }),
      expect.objectContaining({
        kind: "audio",
        nextAction: {
          actionKind: "acquire",
        },
        primary: false,
        sourceUrl: "https://cdn.example.com/audio/1.mp3",
      }),
    ]);
  });

  it("falls back to link or enclosure identity and skips items without identity", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            `<?xml version="1.0"?>
            <rss>
              <channel>
                <item>
                  <title>Entry from Link</title>
                  <link>https://example.com/posts/2</link>
                </item>
                <item>
                  <title>Entry from Enclosure</title>
                  <enclosure
                    type="application/pdf"
                    url="https://cdn.example.com/files/3.pdf"
                  />
                </item>
                <item>
                  <title>Skipped</title>
                </item>
              </channel>
            </rss>`,
            { status: 200 },
          ),
        ),
      ),
    );

    const result = await rssPlugin.observe(
      {
        abortSignal: new AbortController().signal,
        config: {},
        sourceUrl: "https://example.com/feed.xml",
      },
      createPluginContext(),
    );

    expect(result.contents).toHaveLength(2);
    expect(result.contents[0]).toMatchObject({
      externalId: "https://example.com/posts/2",
      title: "Entry from Link",
    });
    expect(result.contents[0]?.assets).toEqual([
      expect.objectContaining({
        kind: "html",
        primary: true,
        sourceUrl: "https://example.com/posts/2",
      }),
    ]);
    expect(result.contents[1]).toMatchObject({
      externalId: "https://cdn.example.com/files/3.pdf",
      title: "Entry from Enclosure",
    });
    expect(result.contents[1]?.assets).toEqual([
      expect.objectContaining({
        kind: "attachment",
        primary: true,
        sourceUrl: "https://cdn.example.com/files/3.pdf",
      }),
    ]);
  });
});

describe("rssPlugin.inspect", () => {
  it("returns source metadata from channel fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            `<?xml version="1.0"?>
            <rss>
              <channel>
                <title> Example Feed </title>
                <description> Weekly notes </description>
              </channel>
            </rss>`,
            { status: 200 },
          ),
        ),
      ),
    );

    const result = await rssPlugin.inspect(
      {
        abortSignal: new AbortController().signal,
        config: {},
        sourceUrl: "https://example.com/feed.xml",
      },
      createPluginContext(),
    );

    expect(result).toMatchObject({
      description: "Weekly notes",
      title: "Example Feed",
      url: "https://example.com/feed.xml",
    });
  });

  it("returns source metadata from rdf channel fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            `<?xml version="1.0"?>
            <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
              <channel>
                <title> Example RDF Feed </title>
                <description> RDF notes </description>
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

    const result = await rssPlugin.inspect(
      {
        abortSignal: new AbortController().signal,
        config: {},
        sourceUrl: "https://example.com/feed.rdf",
      },
      createPluginContext(),
    );

    expect(result).toMatchObject({
      description: "RDF notes",
      title: "Example RDF Feed",
      url: "https://example.com/feed.rdf",
    });
  });
});

describe("rssPlugin.extract", () => {
  it("extracts a sanitized html detail body", async () => {
    await expect(
      rssPlugin.extract(
        {
          asset: {
            body: new TextEncoder().encode(
              `<html><body><article><h1>Entry 1</h1><p>Hello <strong>world</strong>.</p><script>alert("x")</script></article></body></html>`,
            ),
            kind: "html",
            mimeType: "text/html",
            sourceUrl: "https://example.com/posts/1",
          },
        },
        createPluginContext(),
      ),
    ).resolves.toEqual({
      body: "<article><h1>Entry 1</h1><p>Hello <strong>world</strong>.</p></article>",
      format: "html",
    });
  });
});

describe("rssPlugin.acquire", () => {
  it("downloads an asset and normalizes its content type", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(new Uint8Array([1, 2, 3]), {
            headers: {
              "content-type": "text/html; charset=utf-8",
            },
            status: 200,
          }),
        ),
      ),
    );

    const asset = await rssPlugin.acquire(
      {
        abortSignal: new AbortController().signal,
        asset: {
          kind: "html",
          nextAction: {
            actionKind: "acquire",
          },
          observedFingerprints: ["2026-04-28:html:https://example.com/posts/1"],
          primary: true,
          sourceUrl: "https://example.com/posts/1",
        },
        config: {},
        content: {
          externalId: "entry-1",
          kind: "feed-entry",
          publishedAt: null,
          status: "discovered",
          summary: null,
          title: "Entry 1",
        },
      },
      createPluginContext(),
    );

    expect(asset).toMatchObject({
      body: new Uint8Array([1, 2, 3]),
      contentType: "text/html",
      kind: "html",
      primary: true,
      sourceUrl: "https://example.com/posts/1",
    });
    expect(
      asset.acquiredFingerprints.every((fingerprint) =>
        /^2026-04-28:[0-9a-f]{64}$/.test(fingerprint),
      ),
    ).toBe(true);
  });
});
