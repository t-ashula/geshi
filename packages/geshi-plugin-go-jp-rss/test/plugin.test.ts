import { describe, expect, it, vi } from "vitest";

import { goJpRssPlugin } from "../src/index.js";

describe("goJpRssPlugin", () => {
  it("inspects HTML metadata", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            `<html>
              <head>
                <title>Go JP</title>
                <meta name="description" content="Japanese learning updates" />
              </head>
            </html>`,
            { status: 200 },
          ),
        ),
      ),
    );

    await expect(
      goJpRssPlugin.inspect({
        abortSignal: new AbortController().signal,
        config: {},
        logger: createNoopPluginLogger(),
        sourceUrl: "https://example.com",
      }),
    ).resolves.toEqual({
      description: "Japanese learning updates",
      title: "Go JP",
      url: "https://example.com",
    });
  });

  it("observes article links from an HTML page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            `<html>
              <head><title>Go JP</title></head>
              <body>
                <a href="/posts/one"> First article </a>
                <a href="/posts/two"><span>Second article</span></a>
                <a href="#local">ignored</a>
              </body>
            </html>`,
            { status: 200 },
          ),
        ),
      ),
    );

    const observed = await goJpRssPlugin.observe({
      abortSignal: new AbortController().signal,
      config: {},
      logger: createNoopPluginLogger(),
      sourceUrl: "https://example.com/blog",
    });

    expect(observed).toHaveLength(2);
    expect(observed[0]).toMatchObject({
      externalId: "https://example.com/posts/one",
      kind: "article",
      title: "First article",
    });
    expect(observed[0]?.assets).toEqual([
      expect.objectContaining({
        kind: "html",
        primary: true,
        sourceUrl: "https://example.com/posts/one",
      }),
    ]);
  });

  it("acquires HTML assets", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response("<html><body>entry</body></html>", {
            headers: {
              "content-type": "text/html; charset=utf-8",
            },
            status: 200,
          }),
        ),
      ),
    );

    const asset = await goJpRssPlugin.acquire({
      abortSignal: new AbortController().signal,
      asset: {
        kind: "html",
        observedFingerprints: [
          "observed-html-url:https://example.com/posts/one",
        ],
        primary: true,
        sourceUrl: "https://example.com/posts/one",
      },
      config: {},
      content: {
        externalId: "https://example.com/posts/one",
        kind: "article",
        publishedAt: null,
        status: "discovered",
        summary: null,
        title: "First article",
      },
      logger: createNoopPluginLogger(),
    });

    expect(asset.contentType).toBe("text/html");
    expect(asset.kind).toBe("html");
    expect(asset.body.byteLength).toBeGreaterThan(0);
  });
});

function createNoopPluginLogger() {
  return {
    debug() {},
    error() {},
    info() {},
    warn() {},
  };
}
