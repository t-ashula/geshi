import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getContentDetail,
  inspectSource,
  listSourceCollectorPlugins,
} from "../src/source-api.js";

describe("inspectSource", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns inspect data on success", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            data: {
              description: "Weekly notes",
              sourceSlug: "example-podcast-123456789abc",
              title: "Example Podcast",
              url: "https://example.com/feed.xml",
            },
          }),
          {
            headers: {
              "content-type": "application/json",
            },
            status: 200,
          },
        ),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      inspectSource({
        pluginSlug: "podcast-rss",
        url: "https://example.com/feed.xml",
      }),
    ).resolves.toEqual({
      description: "Weekly notes",
      sourceSlug: "example-podcast-123456789abc",
      title: "Example Podcast",
      url: "https://example.com/feed.xml",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/sources/inspect",
      expect.objectContaining({
        body: JSON.stringify({
          pluginSlug: "podcast-rss",
          url: "https://example.com/feed.xml",
        }),
      }),
    );
  });

  it("throws an inspect error on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              error: {
                code: "source_inspect_unrecognized",
                message: "The given URL is not a supported RSS feed.",
              },
            }),
            {
              headers: {
                "content-type": "application/json",
              },
              status: 422,
            },
          ),
        ),
      ),
    );

    await expect(
      inspectSource({
        url: "https://example.com/feed.xml",
      }),
    ).rejects.toThrow("The given URL is not a supported RSS feed.");
  });
});

describe("listSourceCollectorPlugins", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns plugin list data on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              data: [
                {
                  description: "Collect podcast RSS and Atom feeds.",
                  displayName: "Podcast RSS",
                  message: null,
                  pluginSlug: "podcast-rss",
                  sourceKind: "podcast",
                  status: "available",
                },
                {
                  description: "Collect gov-online updates.",
                  displayName: "Go JP RSS",
                  message: null,
                  pluginSlug: "go-jp-rss",
                  sourceKind: "feed",
                  status: "available",
                },
              ],
            }),
            {
              headers: {
                "content-type": "application/json",
              },
              status: 200,
            },
          ),
        ),
      ),
    );

    await expect(listSourceCollectorPlugins()).resolves.toEqual([
      {
        description: "Collect podcast RSS and Atom feeds.",
        displayName: "Podcast RSS",
        message: null,
        pluginSlug: "podcast-rss",
        sourceKind: "podcast",
        status: "available",
      },
      {
        description: "Collect gov-online updates.",
        displayName: "Go JP RSS",
        message: null,
        pluginSlug: "go-jp-rss",
        sourceKind: "feed",
        status: "available",
      },
    ]);
  });
});

describe("getContentDetail", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns content detail with asset urls", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              data: {
                assets: [
                  {
                    id: "asset-1",
                    kind: "audio",
                    mimeType: "audio/mpeg",
                    primary: true,
                    sourceUrl: "https://cdn.example.com/audio/1.mp3",
                    url: "/media/assets/asset-1.mp3",
                  },
                ],
                collectedAt: "2026-04-30T00:00:00.000Z",
                id: "content-1",
                kind: "episode",
                publishedAt: "2026-04-29T00:00:00.000Z",
                source: {
                  id: "source-1",
                  slug: "example-feed",
                  title: "Example Feed",
                },
                status: "stored",
                summary: "Episode summary",
                title: "Episode 1",
              },
            }),
            {
              headers: {
                "content-type": "application/json",
              },
              status: 200,
            },
          ),
        ),
      ),
    );

    await expect(getContentDetail("content-1")).resolves.toMatchObject({
      assets: [
        {
          id: "asset-1",
          url: "/media/assets/asset-1.mp3",
        },
      ],
      id: "content-1",
      source: {
        slug: "example-feed",
      },
      title: "Episode 1",
    });
  });
});
