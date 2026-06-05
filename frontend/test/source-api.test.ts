import { afterEach, describe, expect, it, vi } from "vitest";

import {
  assignSourceToCollection,
  createSource,
  createSourceCollection,
  discoverSources,
  getContentDetail,
  getSourceCollectorSettings,
  inspectSource,
  listSourceCollections,
  listSourceCollectorPlugins,
  listSources,
  previewSource,
  unsubscribeSource,
} from "../src/source-api.js";

describe("listSources", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns source list data on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              data: [
                {
                  collectorSettingsVersion: 1,
                  createdAt: "2026-06-02T00:00:00.000Z",
                  description: "Weekly notes",
                  id: "source-1",
                  kind: "podcast",
                  periodicCrawlEnabled: true,
                  periodicCrawlIntervalMinutes: 60,
                  recordedAt: "2026-06-02T00:00:00.000Z",
                  slug: "example-feed",
                  title: "Example Feed",
                  collectionId: null,
                  subscriptionId: "subscription-1",
                  subscriptionPosition: 0,
                  url: "https://example.com/feed.xml",
                  urlHash: "hash-1",
                  version: 1,
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

    await expect(listSources()).resolves.toEqual([
      {
        collectorSettingsVersion: 1,
        createdAt: "2026-06-02T00:00:00.000Z",
        description: "Weekly notes",
        id: "source-1",
        kind: "podcast",
        periodicCrawlEnabled: true,
        periodicCrawlIntervalMinutes: 60,
        recordedAt: "2026-06-02T00:00:00.000Z",
        slug: "example-feed",
        title: "Example Feed",
        collectionId: null,
        subscriptionId: "subscription-1",
        subscriptionPosition: 0,
        url: "https://example.com/feed.xml",
        urlHash: "hash-1",
        version: 1,
      },
    ]);
  });
});

describe("listSourceCollections", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns collection list data on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              data: [
                {
                  createdAt: "2026-06-02T00:00:00.000Z",
                  id: "collection-1",
                  parentCollectionId: null,
                  position: 0,
                  sourceCount: 1,
                  title: "Work",
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

    await expect(listSourceCollections()).resolves.toEqual([
      {
        createdAt: "2026-06-02T00:00:00.000Z",
        id: "collection-1",
        parentCollectionId: null,
        position: 0,
        sourceCount: 1,
        title: "Work",
      },
    ]);
  });
});

describe("createSource", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns created source data on success", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            data: {
              collectorSettingsVersion: 1,
              createdAt: "2026-06-02T00:00:00.000Z",
              description: "Weekly notes",
              id: "source-1",
              kind: "podcast",
              periodicCrawlEnabled: true,
              periodicCrawlIntervalMinutes: 60,
              recordedAt: "2026-06-02T00:00:00.000Z",
              slug: "example-feed",
              title: "Example Feed",
              collectionId: null,
              subscriptionId: "subscription-1",
              subscriptionPosition: 0,
              url: "https://example.com/feed.xml",
              urlHash: "hash-1",
              version: 1,
            },
          }),
          {
            headers: {
              "content-type": "application/json",
            },
            status: 201,
          },
        ),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createSource({
        description: "Weekly notes",
        sourceSlug: "example-feed",
        title: "Example Feed",
        url: "https://example.com/feed.xml",
      }),
    ).resolves.toEqual({
      collectorSettingsVersion: 1,
      createdAt: "2026-06-02T00:00:00.000Z",
      description: "Weekly notes",
      id: "source-1",
      kind: "podcast",
      periodicCrawlEnabled: true,
      periodicCrawlIntervalMinutes: 60,
      recordedAt: "2026-06-02T00:00:00.000Z",
      slug: "example-feed",
      title: "Example Feed",
      collectionId: null,
      subscriptionId: "subscription-1",
      subscriptionPosition: 0,
      url: "https://example.com/feed.xml",
      urlHash: "hash-1",
      version: 1,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/sources",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });
});

describe("createSourceCollection", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns created collection data on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              data: {
                createdAt: "2026-06-02T00:00:00.000Z",
                id: "collection-1",
                parentCollectionId: null,
                position: 0,
                sourceCount: 0,
                title: "Work",
              },
            }),
            {
              headers: {
                "content-type": "application/json",
              },
              status: 201,
            },
          ),
        ),
      ),
    );

    await expect(
      createSourceCollection({
        position: 0,
        title: "Work",
      }),
    ).resolves.toEqual({
      createdAt: "2026-06-02T00:00:00.000Z",
      id: "collection-1",
      parentCollectionId: null,
      position: 0,
      sourceCount: 0,
      title: "Work",
    });
  });
});

describe("assignSourceToCollection", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns updated source data on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              data: {
                collectorSettingsVersion: 1,
                createdAt: "2026-06-02T00:00:00.000Z",
                description: "Weekly notes",
                id: "source-1",
                kind: "podcast",
                periodicCrawlEnabled: true,
                periodicCrawlIntervalMinutes: 60,
                recordedAt: "2026-06-02T00:00:00.000Z",
                slug: "example-feed",
                title: "Example Feed",
                collectionId: "collection-1",
                subscriptionId: "subscription-1",
                subscriptionPosition: 2,
                url: "https://example.com/feed.xml",
                urlHash: "hash-1",
                version: 1,
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

    await expect(
      assignSourceToCollection("source-1", {
        collectionId: "collection-1",
        position: 2,
      }),
    ).resolves.toEqual({
      collectorSettingsVersion: 1,
      createdAt: "2026-06-02T00:00:00.000Z",
      description: "Weekly notes",
      id: "source-1",
      kind: "podcast",
      periodicCrawlEnabled: true,
      periodicCrawlIntervalMinutes: 60,
      recordedAt: "2026-06-02T00:00:00.000Z",
      slug: "example-feed",
      title: "Example Feed",
      collectionId: "collection-1",
      subscriptionId: "subscription-1",
      subscriptionPosition: 2,
      url: "https://example.com/feed.xml",
      urlHash: "hash-1",
      version: 1,
    });
  });
});

describe("unsubscribeSource", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns on 204 response", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(null, {
          status: 204,
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(unsubscribeSource("subscription-1")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/subscriptions/subscription-1",
      expect.objectContaining({
        method: "DELETE",
      }),
    );
  });
});

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

describe("discoverSources", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns discovery data on success", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            data: {
              candidates: [
                {
                  description: "Weekly notes",
                  pluginSlug: "podcast-rss",
                  previewAvailable: true,
                  sourceKind: "podcast",
                  sourceSlug: "example-feed",
                  title: "Example Feed",
                  url: "https://example.com/feed.xml",
                },
              ],
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
      discoverSources({
        url: "https://example.com/",
      }),
    ).resolves.toEqual({
      candidates: [
        {
          description: "Weekly notes",
          pluginSlug: "podcast-rss",
          previewAvailable: true,
          sourceKind: "podcast",
          sourceSlug: "example-feed",
          title: "Example Feed",
          url: "https://example.com/feed.xml",
        },
      ],
    });
  });
});

describe("previewSource", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns preview data on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              data: {
                items: [
                  {
                    kind: "episode",
                    publishedAt: null,
                    summary: "Summary",
                    title: "Episode 1",
                  },
                ],
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

    await expect(
      previewSource({
        pluginSlug: "podcast-rss",
        url: "https://example.com/feed.xml",
      }),
    ).resolves.toEqual({
      items: [
        {
          kind: "episode",
          publishedAt: null,
          summary: "Summary",
          title: "Episode 1",
        },
      ],
    });
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

describe("getSourceCollectorSettings", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns collector settings data on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              data: {
                baseVersion: 2,
                items: [
                  {
                    key: "userAgent",
                    type: {
                      type: "text",
                    },
                    value: "geshi-test",
                  },
                ],
                periodicCrawl: {
                  enabled: true,
                  intervalMinutes: 30,
                },
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

    await expect(getSourceCollectorSettings("source-1")).resolves.toEqual({
      baseVersion: 2,
      items: [
        {
          key: "userAgent",
          type: {
            type: "text",
          },
          value: "geshi-test",
        },
      ],
      periodicCrawl: {
        enabled: true,
        intervalMinutes: 30,
      },
    });
  });
});
